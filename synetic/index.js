const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// Configuration
const TICKET_CATEGORY_ID = '1412187264171118732';
const SUPPORT_ROLE_ID = '1412185466337366076';
const MAX_TICKETS_PER_USER = 2;

client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);
  console.log(`📊 Limite de tickets: ${MAX_TICKETS_PER_USER} par utilisateur`);
});

// Création du message de tickets
client.on('messageCreate', async message => {
  if (message.content === '!setup-tickets' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_reason')
          .setPlaceholder('Sélectionnez une raison')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('BDA')
              .setDescription('Besoin aide')
              .setValue('bda'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Mort RP')
              .setDescription('Dossier de mort RP')
              .setValue('mort_rp'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Question général')
              .setDescription('Une question sur le serveur')
              .setValue('question_generale'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Wipe')
              .setDescription('Demande de wipe')
              .setValue('wipe_request'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Boutique')
              .setDescription('Achat boutique')
              .setValue('boutique'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Autres')
              .setDescription('Autres raisons')
              .setValue('autres')
          ),
      );

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Ouvrir un ticket')
      .setDescription('Veuillez sélectionner une raison pour ouvrir un ticket dans le menu déroulant ci-dessous.\n\n**Limite:** ' + MAX_TICKETS_PER_USER + ' tickets maximum par membre.');

    try {
      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete();
      console.log('✅ Message de tickets créé avec succès!');
    } catch (error) {
      console.error('❌ Erreur lors de la création du message:', error);
    }
  }

  if (message.content === '!close') {
    // Vérifier si c'est un ticket en regardant le topic
    const isTicket = message.channel.topic && message.channel.topic.includes('ticket-');
    
    if (!isTicket) {
      return message.reply('❌ Cette commande ne peut être utilisée que dans un ticket.');
    }

    console.log(`🔒 Tentative de fermeture du ticket: ${message.channel.name}`);
    
    // Vérifier les permissions
    const userHasPermission = 
      message.member.roles.cache.has(SUPPORT_ROLE_ID) || 
      (message.channel.topic && message.channel.topic.includes(`ticket-${message.author.id}`));
    
    if (!userHasPermission) {
      return message.reply('❌ Vous n\'avez pas la permission de fermer ce ticket.');
    }
    
    try {
      await message.channel.delete();
      console.log('✅ Ticket fermé avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la fermeture du ticket:', error);
      message.reply('❌ Impossible de fermer le ticket. Vérifiez les permissions du bot.');
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  
  if (interaction.customId === 'ticket_reason') {
    await interaction.deferReply({ ephemeral: true });
    
    console.log(`🎫 Demande de ticket de ${interaction.user.tag}`);
    console.log(`📋 Raison sélectionnée: ${interaction.values[0]}`);

    const reason = interaction.values[0];
    
    // Objet corrigé pour correspondre aux nouvelles valeurs
    const reasonLabels = {
      'bda': 'BDA (Besoin aide)',
      'mort_rp': 'Mort RP (Dossier de mort RP)',
      'question_generale': 'Question générale',
      'wipe_request': 'Wipe (Demande de wipe)',
      'boutique': 'Boutique (Achat boutique)',
      'autres': 'Autres raisons'
    };

    // Vérifier si la raison existe dans l'objet
    if (!reasonLabels[reason]) {
      console.error(`❌ Raison non reconnue: ${reason}`);
      return interaction.editReply({ 
        content: '❌ Erreur: raison non reconnue. Veuillez réessayer.' 
      });
    }

    // Vérifier combien de tickets l'utilisateur a déjà
    const userTickets = interaction.guild.channels.cache.filter(
      channel => channel.topic && channel.topic.includes(`ticket-${interaction.user.id}`)
    );
    
    console.log(`📊 Tickets ouverts par ${interaction.user.tag}: ${userTickets.size}`);
    
    if (userTickets.size >= MAX_TICKETS_PER_USER) {
      console.log(`❌ Utilisateur ${interaction.user.tag} a déjà ${userTickets.size} tickets`);
      return interaction.editReply({ 
        content: `❌ Vous avez déjà ${userTickets.size} ticket(s) ouvert(s). Vous ne pouvez pas avoir mais de ${MAX_TICKETS_PER_USER} tickets simultanément.` 
      });
    }
    
    try {
      // VÉRIFIER que la catégorie existe
      const category = interaction.guild.channels.cache.get(TICKET_CATEGORY_ID);
      if (!category || category.type !== ChannelType.GuildCategory) {
        console.error('❌ Catégorie introuvable ou invalide:', TICKET_CATEGORY_ID);
        return interaction.editReply({ 
          content: '❌ Erreur de configuration: catégorie introuvable. Contactez un administrateur.' 
        });
      }

      // VÉRIFIER que le rôle existe
      const supportRole = interaction.guild.roles.cache.get(SUPPORT_ROLE_ID);
      if (!supportRole) {
        console.error('❌ Rôle support introuvable:', SUPPORT_ROLE_ID);
        return interaction.editReply({ 
          content: '❌ Erreur de configuration: rôle support introuvable. Contactez un administrateur.' 
        });
      }
      
      // Créer le canal de ticket
      const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${userTickets.size + 1}`;
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `ticket-${interaction.user.id}-${Date.now()}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ],
          },
          {
            id: SUPPORT_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ],
          },
        ],
      });
      
      // Message de bienvenue dans le ticket
      const ticketEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Ticket - ${reasonLabels[reason]} (#${userTickets.size + 1})`)
        .setDescription(`Bonjour ${interaction.user},\n\nL'équipe de support vous répondra dès que possible.\n\n**Raison:** ${reasonLabels[reason]}\n**Ticket:** ${userTickets.size + 1}/${MAX_TICKETS_PER_USER}`)
        .setFooter({ text: 'Fermez le ticket avec !close' });
      
      await channel.send({ 
        content: `${interaction.user} <@&${SUPPORT_ROLE_ID}>`, 
        embeds: [ticketEmbed] 
      });
      
      await interaction.editReply({ 
        content: `✅ Votre ticket a été créé: ${channel}\n\nVous avez maintenant ${userTickets.size + 1}/${MAX_TICKETS_PER_USER} tickets ouverts.` 
      });
      
      console.log(`✅ Ticket créé pour ${interaction.user.tag}: ${channel.name} (${userTickets.size + 1}/${MAX_TICKETS_PER_USER})`);
      console.log(`📝 Raison: ${reasonLabels[reason]}`);
    } catch (error) {
      console.error('❌ Erreur lors de la création du ticket:', error);
      if (error.code === 50035) {
        await interaction.editReply({ 
          content: '❌ Erreur de configuration: ID de catégorie invalide. Contactez un administrateur.' 
        });
      } else {
        await interaction.editReply({ 
          content: '❌ Une erreur s\'est produite lors de la création de votre ticket.' 
        });
      }
    }
  }
});

// Gestion des erreurs
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Connexion
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🔗 Tentative de connexion...'))
  .catch(error => {
    console.error('❌ Erreur de connexion:', error);
    console.log('💡 Vérifiez votre token dans le fichier .env');
  });