/* Local CSS theme support and Preset Themes Library for Foxy. */
(function () {
  'use strict';

  const STYLE_ID = 'foxy-custom-theme';
  const TRIAL_STYLE_ID = 'foxy-trial-theme';
  const STORAGE_KEY = 'vh-custom-theme-css';
  const NAME_KEY = 'vh-custom-theme-name';
  const PRESET_ID_KEY = 'vh-preset-theme-id';
  const PREFS_KEY = 'vh-custom-theme-preferences';
  const MAX_SIZE = 512 * 1024;

  const SELECTOR_ALIASES = {
    appMount: 'discord-body', app: 'discord-layout', container: 'discord-layout',
    guilds: 'discord-rail', guild: 'rail-servers', guildsWrapper: 'discord-rail',
    sidebar: 'discord-sidebar', chat: 'discord-main', chatContent: 'discord-view',
    messagesWrapper: 'chat-messages-container', chatMessages: 'chat-messages-container',
    scroller: 'custom-scroll', channels: 'server-channels-list', channel: 'server-channel-item',
    members: 'members-list-container', membersWrap: 'members-list-container',
    member: 'participant-card', header: 'view-header',
    wrapper: 'glass', popout: 'profile-popout', modal: 're-modal',
    input: 'input', button: 'button', channelTextArea: 'chat-input-container',
    scrollableContainer: 'chat-input-container', searchBar: 'search-input'
  };

  const ROOT_THEME_CLASSES = /\.(?:visual-refresh|theme-dark|theme-light|theme-darker|theme-midnight)\b/g;

  const VARIABLE_ALIASES = {
    '--main-color': '--primary', '--hover-color': '--primary-hover', '--success-color': '--success',
    '--danger-color': '--danger', '--online-color': '--online-color', '--idle-color': '--idle-color',
    '--dnd-color': '--dnd-color', '--streaming-color': '--streaming-color', '--offline-color': '--offline-color',
    '--background-image': '--app-background-image', '--background': '--app-background-image',
    '--wallpaper': '--app-background-image', '--synth-background-image': '--app-background-image',
    '--primary1-colour': '--primary', '--primary2-colour': '--primary-hover',
    '--activetext-colour': '--text-main', '--secondary3-colour': '--bg-dark',
    '--rgb-highlight': '--primary-rgb', '--rgb-text': '--text-rgb',
    '--rgb-background': '--background-rgb', '--rgb-close-button': '--danger-rgb',
    '--rgb-online-color': '--online-rgb', '--rgb-afk-color': '--idle-rgb',
    '--rgb-dnd-color': '--dnd-rgb', '--rgb-streaming-color': '--streaming-rgb',
    // Discord & BetterDiscord Full Token Bridge
    '--background-primary': '--main-bg',
    '--background-secondary': '--sidebar-bg',
    '--background-tertiary': '--rail-bg',
    '--background-secondary-alt': '--bg-alt',
    '--background-floating': '--modal-bg',
    '--background-accent': '--accent-bg',
    '--text-normal': '--text-main',
    '--text-muted': '--text-muted',
    '--header-primary': '--text-main',
    '--header-secondary': '--text-muted',
    '--interactive-normal': '--text-interactive',
    '--interactive-hover': '--text-interactive-hover',
    '--interactive-active': '--primary',
    '--channeltextarea-background': '--chat-input-bg',
    '--brand-experiment': '--primary',
    '--brand-experiment-560': '--primary',
    '--brand-500': '--primary',
    '--brand-600': '--primary-hover',
    '--accent-color': '--primary',
    '--accent': '--primary',
    '--font-primary': '--main-font',
    '--font-display': '--main-font',
    '--font': '--main-font',
    '--main-font': '--main-font',
    '--font-code': '--code-font',
    '--font-monospace': '--code-font',
    '--code-font': '--code-font',
    '--rs-online-color': '--online-color',
    '--rs-idle-color': '--idle-color',
    '--rs-dnd-color': '--dnd-color',
    '--rs-offline-color': '--offline-color',
    '--rs-streaming-color': '--streaming-color'
  };

  // Embedded Manifest of all 101 themes
  const PRESET_THEMES_MANIFEST = {"version":"1.0","total":101,"categories":{"all":"الكل","anime":"أنمي (Anime)","glass":"زجاجي وشفاف (Glass)","cyberpunk":"سايبربانك ونيون (Cyberpunk & Neon)","dark":"داكن وملكي (Dark & AMOLED)","minimal":"مينيمال وبسيط (Minimal)","modern":"عصري وOS (Modern & Material)","gaming":"ألعاب وموسيقى (Gaming & Media)","general":"منوعات عامة (General)"},"themes":[{"id":"aider_theme_css","file":"aider.theme.css","name":"aider","author":"Blade0, Aidak","version":"1.0","description":"Yet another skeuo theme, focused around being square, while others are circles.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"alanwalker_theme_css","file":"alanWalker.theme.css","name":"Alan Walker Theme","author":"lolpowerluke","version":"1.3.8","description":"dark theme with Alan Walker's logo as background, made to be as customizable as possible, open an issue on codeberg if you want more customization and I will do my best to add it","category":"dark","bgImage":"https://i.imgur.com/tt9snCk.png?1","accentColor":"#6366f1","bgColor":"#000000","sizeKb":18},{"id":"alternativevistaautoupdate_theme_css","file":"AlternativeVistaAutoUpdate.theme.css","name":"Alternative Vista","author":"Frekk","version":"Auto Update","description":"Cutting edge 2015 theme. Inspired by skeuomorphism, windows aero and the old Steam UI. I brought over some styling from SkeuoCord and DTM-08","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":0},{"id":"amethyst_theme_css","file":"amethyst.theme.css","name":"Amethyst","author":"legume#0173","version":"1.7.0","description":"A calm, deep purple theme for those seeking serenity.","category":"general","bgImage":null,"accentColor":"#a855f7","bgColor":"#111214","sizeKb":0},{"id":"amoled-cord_theme_css","file":"amoled-cord.theme.css","name":"AMOLED-Cord","author":"LuckFire","version":"5.0.11","description":"A basically pitch black theme for Discord. Lights out, baby!","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":29},{"id":"azurite_theme_css","file":"Azurite.theme.css","name":"Azurite","author":"DevEvil","version":"4","description":"Bring a new look to your Discord with Azurite, A dark and customizable theme","category":"dark","bgImage":"https://i.imgur.com/kP6FFU5.png","accentColor":"#3b82f6","bgColor":"#090a0f","sizeKb":1},{"id":"blurplerecolor_theme_css","file":"BlurpleRecolor.theme.css","name":"BlurpleRecolor","author":"DevilBro","version":"1.0.0","description":"Replaces Discord's native Blurple and Boost-Pink with your own Color","category":"glass","bgImage":null,"accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":1},{"id":"bubblethemev2_theme_css","file":"BubbleThemev2.theme.css","name":"Bubble Theme v2","author":"ShadowDevilsAvenged","version":"2.9","description":"Bubbles, Bubbles and more Bubbles.","category":"general","bgImage":"https://images.alphacoders.com/263/263303.jpg","accentColor":"#5865F2","bgColor":"#111214","sizeKb":115},{"id":"chillax_theme_css","file":"chillax.theme.css","name":"Chillax","author":"Chillax Squad","version":"2.1.3","description":"The theme where calm meets customization.","category":"general","bgImage":"https://warrayquipsome.github.io/Chillax/Wallpapers/chillax-default.png","accentColor":"#5865F2","bgColor":"#111214","sizeKb":10},{"id":"clearvision-v7-betterdiscord_theme_css","file":"ClearVision-v7-BetterDiscord.theme.css","name":"ClearVision V7 for BetterDiscord","author":"ClearVision Team","version":"7.0.1","description":"Highly customizable theme for BetterDiscord.","category":"general","bgImage":"https://clearvision.github.io/images/sapphire.jpg","accentColor":"#2780e6","bgColor":"#111214","sizeKb":8},{"id":"cursedcord_theme_css","file":"CursedCord.theme.css","name":"CursedCord","author":"CursedElectric","version":"1.0","description":"A sharp theme that removes nitro features and buttons, and rounded edges, and adds lots of color customization","category":"anime","bgImage":"https://cursedelectric.neocities.org/fucking%20images/Cursedcord%20icon%20lazy.png","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":3},{"id":"cyan_theme_css","file":"Cyan.theme.css","name":"Cyan","author":"DaBluLite","version":"7.0.0","description":"Powerful UX, stunning visuals, like never before","category":"general","bgImage":"https://github.com/DaBluLite/Cyan/blob/next/cyan-ocean-waves.png?raw=true","accentColor":"#00e5ff","bgColor":"#111214","sizeKb":3},{"id":"cyberpunk2077_theme_css","file":"cyberpunk2077.theme.css","name":"Cyberpunk 2077","author":"Patryk Bielanin | bielak","version":"1.0.15","description":"Cyberpunk 2077 UI styled theme for better discord","category":"cyberpunk","bgImage":null,"accentColor":"#00f0ff","bgColor":"#170005","sizeKb":1},{"id":"darkmatter_theme_css","file":"DarkMatter.theme.css","name":"Dark Matter","author":"Tropical#8908, Hammock#3110","version":"3.0.0","description":"A cold, dark & frosty theme.","category":"dark","bgImage":"https://i.imgur.com/7SbtKvw.png","accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"darkneon_theme_css","file":"DarkNeon.theme.css","name":"Dark Neon","author":"Bates","version":"3.0.0","description":"A dark theme with bright neon-y colors, now with more options!","category":"cyberpunk","bgImage":null,"accentColor":"#04d9ff","bgColor":"#0d0d15","sizeKb":2},{"id":"ddex4_theme_css","file":"ddex4.theme.css","name":"DDEX4","author":"Blade0","version":"3.1","description":"Discord's scrapped Design Experiment V4, made real.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":0},{"id":"discord16_theme_css","file":"discord16.theme.css","name":"Discord 1.6","author":"dom1torii","version":"0.0.3","description":"CS 1.6 + Old Steam Inspired Theme for Discord","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"discord11_theme_css","file":"Discord11.theme.css","name":"Discord 11","author":"zuzumi-f","version":"4","description":"Based on Windows 11's UI","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":3},{"id":"discorddark_theme_css","file":"discorddark.theme.css","name":"Discord Dark","author":"SyndiShanX","version":"1.59","description":"A Github Dark Theme for Discord, meant to be used with Discord Dark Mode","category":"dark","bgImage":null,"accentColor":"#3a496b","bgColor":"#000000","sizeKb":11},{"id":"discord_reborn_theme_css","file":"Discord Reborn.theme.css","name":"Discord Reborn","author":"Izy","version":"2.0","description":"Transparent, fully customizable theme.","category":"modern","bgImage":"https://rawcdn.githack.com/squee666/Discord-Themes/2035b9f127e6c79c95459b24e299ef3156ed552c/d3lnerI.jpeg?raw=true","accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":1},{"id":"discordplus_theme_css","file":"DiscordPlus.theme.css","name":"Discord+","author":"PlusInsta","version":"3.4.1","description":"A sleek, customizable Discord theme.","category":"minimal","bgImage":"https://i.ibb.co/1yMXFFr/Moonlit-Dusk-2018.webp","accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":4},{"id":"discordnight_theme_css","file":"DiscordNight.theme.css","name":"DiscordNight","author":"KillYoy#0295","version":"0.9.5.8","description":"Dark and compact theme for BetterDiscord","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":0},{"id":"discordrecolor_theme_css","file":"DiscordRecolor.theme.css","name":"DiscordRecolor","author":"DevilBro","version":"1.0.0","description":"Allows you to customize Discord's native Color Scheme","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":5},{"id":"dtm-08_theme_css","file":"dtm-08.theme.css","name":"DTM-08","author":"11pixels","version":"2.0.2","description":"A skeuomorphic/glossy theme","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":0},{"id":"dtm-16_theme__1__css","file":"dtm-16.theme (1).css","name":"DTM-16","author":"11pixels","version":"7","description":"Formerly known as Oldcord, this theme tries to bring back the 2016 look of Discord","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":0},{"id":"eris_theme_css","file":"Eris.theme.css","name":"Eris","author":"Rock#5429","version":"1.4","description":"A darker, cooler, classier look for Discord.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":0},{"id":"fallout4terminal_theme_css","file":"Fallout4Terminal.theme.css","name":"Fallout 4 Terminal","author":"Bates","version":"4.0.0","description":"A theme inspired by Fallout 4's terminals!","category":"cyberpunk","bgImage":null,"accentColor":"#4aef98","bgColor":"#0d0d15","sizeKb":3},{"id":"fluent_theme_css","file":"Fluent.theme.css","name":"Fluent","author":"Gibbu","version":"1.0.10","description":"Brings the look of Windows 11 to Discord.","category":"modern","bgImage":null,"accentColor":"#62cdfe","bgColor":"#0f172a","sizeKb":1},{"id":"frostedglass_theme_css","file":"FrostedGlass.theme.css","name":"Frosted Glass","author":"Gibbu#1211","version":"2.0.0","description":"Display your picture of choice with adjustable blur and brightness. Dark theme is required.","category":"glass","bgImage":"https://i.imgur.com/kYW2H5C.jpg","accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":4},{"id":"fvui_theme_css","file":"FVUI.theme.css","name":"FVUI","author":"feorev","version":"2.0.0","description":"Blur is the New Black","category":"glass","bgImage":"https://feorev.github.io/Themes/Discord/FVUI/assets/SubThemes/CustomBackground.css","accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":9},{"id":"ggo_kirito_theme_css","file":"GGO_Kirito.theme.css","name":"GGO Kirito","author":"VaporousCreeper","version":"1.4.X","description":"A theme with Kirito and Deathgun fighting in GGO (Gun Gale Online)","category":"anime","bgImage":"https://images.alphacoders.com/632/632525.png","accentColor":"#ff4b91","bgColor":"#000000","sizeKb":1},{"id":"github-dark_theme_css","file":"GitHub-Dark.theme.css","name":"GitHub Dark","author":"Sango","version":"1.0.0","description":"A theme based off of the GitHub Dark theme.","category":"dark","bgImage":null,"accentColor":"#5865f2","bgColor":"#090c10","sizeKb":16},{"id":"glass_wave_theme_css","file":"Glass Wave.theme.css","name":"Glass Wave","author":"Elisniper","version":"1.2","description":"Discord Glass Wave Theme.","category":"glass","bgImage":null,"accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":0},{"id":"gruvboxsharp_theme_css","file":"GruvboxSharp.theme.css","name":"Gruvbox Sharp","author":"round-panda","version":"4.1","description":"Gruvbox Dark Soft palette with sharp corners and IBM Plex","category":"dark","bgImage":null,"accentColor":"#22c55e","bgColor":"#090a0f","sizeKb":27},{"id":"horizontalserverlist_theme_css","file":"HorizontalServerList.theme.css","name":"Horizontal Server List","author":"Gibbu","version":"3.0.0","description":"Moves the server list from the left to the top of Discord.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"kaleidoscope_theme_css","file":"kaleidoscope.theme.css","name":"kaleidoscope","author":"mackenzie#0173","version":"2.4.2","description":"A vibrant, colourful dark theme inspired by the 2077 theme for VSCode.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":0},{"id":"discordia_theme_css","file":"discordia.theme.css","name":"Lande della Discordia","author":"ungiglio","version":"25.1","description":"Lande della Discordia implements a glass purple and lightblue details on your client!","category":"glass","bgImage":"https://ungiglio.github.io/DiscordDiscordia/awkglass/assets/bgImg.jpg","accentColor":"#b266ff","bgColor":"#0f172a","sizeKb":2},{"id":"material_blue_discord_theme_css","file":"Material Blue Discord.theme.css","name":"Material Blue Discord","author":"Elisniper","version":"2.1.0","description":"Material Blue Discord Theme.","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":0},{"id":"material-discord_theme_css","file":"Material-Discord.theme.css","name":"Material Discord","author":"CapnKitten","version":"3.0.7","description":"A theme based on Google's Material Design","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":2},{"id":"materialdesign_theme_css","file":"MaterialDesign.theme.css","name":"MaterialDesign","author":"TheCommieAxolotl#0001","version":"1.0.0","description":"A clean theme inspired by Google's Material Design Guidelines.","category":"minimal","bgImage":null,"accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":15},{"id":"materialistic_theme_css","file":"Materialistic.theme.css","name":"Materialistic","author":"BigMeanie","version":"1.0.0","description":"A clean material design theme for discord with a simple accent color","category":"minimal","bgImage":null,"accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":2},{"id":"midnight_theme_css","file":"midnight.theme.css","name":"midnight","author":"refact0r","version":"2.1.1","description":"a dark, customizable discord theme.","category":"dark","bgImage":"https://refact0r.github.io/midnight-discord/assets/Font_Awesome_5_solid_moon.svg","accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":8},{"id":"minimalcord_theme_css","file":"MinimalCord.theme.css","name":"MinimalCord","author":"Gibbu#1211","version":"2.0.0","description":"Changes Discord enough to give it a fresh feel while also making it darker. Supports both Light and Dark themes.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"minimalimprovement_theme_css","file":"MinimalImprovement.theme.css","name":"MinimalImprovement","author":"Juicysteak117","version":"3.14.0","description":"Dark and minimal mode, made geometric and sleek. Message me if you have a plugin/theme that you need compatibility for or if you found something not themed.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"minimalimprovementborderless_theme_css","file":"MinimalImprovementBorderless.theme.css","name":"MinimalImprovementBorderless","author":"Juicysteak117","version":"3.14.0","description":"Dark and minimal mode, made geometric and sleek. Now without borders. Message me if you have a plugin/theme that you need compatibility for or if you found something not themed.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"mixpack_theme_css","file":"MixPack.theme.css","name":"MixPack","author":"Mixter213","version":"1.0","description":"A pack that combines things I've created and liked the look of.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":0},{"id":"moon-rabbits-dream-about-virtual_theme_css","file":"Moon-Rabbits-Dream-About-Virtual.theme.css","name":"Moon Rabbits Dream About Virtual","author":"zuzumi-f","version":"4","description":"Based in Tsukino Mito Album Presentation","category":"general","bgImage":"https://zuzumi-f.github.io/Moon-Rabbits-Dream-About-Virtual/release/background-animation.css","accentColor":"#5865F2","bgColor":"#111214","sizeKb":4},{"id":"neobrutal_theme_css","file":"Neobrutal.theme.css","name":"Neobrutal","author":"Saltssaumure","version":"1.1","description":"Neobrutalism brought to Discord.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"neptune_theme_css","file":"Neptune.theme.css","name":"Neptune","author":"DevEvil","version":"4","description":"A dark, blue and customizable theme","category":"dark","bgImage":"https://i.imgur.com/S8avvX2.png","accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"neutron_theme_css","file":"neutron.theme.css","name":"Neutron Nova","author":"Cruxie + w1zard","version":"9.0","description":"A highly customizable Vibrant Purple Space Theme, now sugar free!","category":"general","bgImage":"https://i.vgy.me/EHVyhc.jpg","accentColor":"#5865F2","bgColor":"#111214","sizeKb":3},{"id":"newakamegakill_theme_css","file":"NewAkameGaKill.theme.css","name":"New Akame Ga Kill! Theme","author":"ShadowDevilsAvenged","version":"7.5","description":"Newer Akame Ga Kill! theme for my return","category":"anime","bgImage":"https://i.imgur.com/1JVM8CU.jpg","accentColor":"#f43f5e","bgColor":"#18121e","sizeKb":107},{"id":"newbnha_theme_css","file":"NewBNHA.theme.css","name":"New BNHA Theme","author":"ShadowDevilsAvenged","version":"7","description":"Newer BNHA theme for my return","category":"anime","bgImage":"https://images3.alphacoders.com/744/744194.png","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":99},{"id":"newkemonofriends_theme_css","file":"NewKemonoFriends.theme.css","name":"New Kemono Friends Theme","author":"ShadowDevilsAvenged","version":"7.3","description":"Newer Kemono Friends theme for my return","category":"anime","bgImage":"https://images5.alphacoders.com/854/854590.png","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":99},{"id":"newremtheme_theme_css","file":"NewRemTheme.theme.css","name":"New Rem Theme","author":"ShadowDevilsAvenged","version":"7.2","description":"Newer Rem theme for my return","category":"anime","bgImage":"https://images8.alphacoders.com/767/767470.jpg","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":98},{"id":"nier-light-source_theme_css","file":"NieR-Light-Source.theme.css","name":"NieR: Automata UI Light","author":"Accrazed#2710","version":"1.4","description":"Glory to Mankind. ||","category":"anime","bgImage":null,"accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":2},{"id":"noctis-viola_theme_css","file":"noctis-viola.theme.css","name":"noctis-viola-discord-theme","author":"Chase Ingebritson","version":"0.6.1","description":"A Better Discord theme based on the Noctis Viola VSCode theme.","category":"dark","bgImage":null,"accentColor":"#a855f7","bgColor":"#090a0f","sizeKb":0},{"id":"nocturnal_theme_css","file":"nocturnal.theme.css","name":"Nocturnal","author":"w1zard and cruxie","version":"4.0.0","description":"For when default discord just isn't dark enough, a theme for those who live a night. Now with extra spice!","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":5},{"id":"nord_theme_css","file":"Nord.theme.css","name":"Nord","author":"Daggy1234","version":"1.0.0","description":"A theme for discord inspired by the deep blues of the Atlantic","category":"minimal","bgImage":null,"accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":0},{"id":"nordic_theme_css","file":"nordic.theme.css","name":"Nordic","author":"orblazer#9152","version":"4.13.1","description":"Complete theme for Nordic (https://www.nordtheme.com/)","category":"minimal","bgImage":"https://raw.githubusercontent.com/orblazer/discord-nordic/v4.13.1/assets/user/profile/badge-active-developer.svg","accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":47},{"id":"notanotheranimetheme_theme_css","file":"NotAnotherAnimeTheme.theme.css","name":"NotAnotherAnimeTheme","author":"puckzxz#2080","version":"3.2","description":"An easily customizable and automatically updating theme","category":"anime","bgImage":"https://i.imgur.com/j1Z6HVc.jpg","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":5},{"id":"novum_theme_css","file":"Novum.theme.css","name":"Novum","author":"Przemec & Net-Runner","version":"5.9.0","description":"Red galaxy theme enhanced with couple of addons and small features.","category":"general","bgImage":"https://przemec.github.io/Novum/assets/images/app_min.png","accentColor":"#992727","bgColor":"#111214","sizeKb":3},{"id":"nox_theme_css","file":"Nox.theme.css","name":"Nox","author":"Lilian Tedone & Zerebos","version":"2.0.0","description":"A theme for Discord","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":2},{"id":"ocean_theme_css","file":"Ocean.theme.css","name":"Ocean","author":"DevEvil","version":"3.1","description":"Highly customized and customizable theme for Discord","category":"general","bgImage":"https://i.imgur.com/weOUkrT.png","accentColor":"#3b82f6","bgColor":"#111214","sizeKb":3},{"id":"old-bnha-theme_theme_css","file":"Old-BNHA-Theme.theme.css","name":"Old BNHA Theme Returns","author":"ShadowDevilsAvenged","version":"7","description":"Say Hello to the BNHA theme once again","category":"anime","bgImage":"https://winzoro.net/uploads/posts/2021-01/1612118244_1.jpg","accentColor":"#ff4b91","bgColor":"#18121e","sizeKb":98},{"id":"old-akamegakill-theme_theme_css","file":"Old-AkameGaKill-Theme.theme.css","name":"Old-Akame_Ga_Kill-Theme","author":"ShadowDevilsAvenged","version":"7","description":"Akame from Akame No Kill","category":"anime","bgImage":"https://images5.alphacoders.com/542/542751.jpg","accentColor":"#f43f5e","bgColor":"#18121e","sizeKb":108},{"id":"oldcord_theme_css","file":"OldCord.theme.css","name":"OldCord","author":"milbit, kinggamingyt","version":"2.1","description":"Restores discord's 2020 UI","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":2},{"id":"operagx_theme_css","file":"OperaGX.theme.css","name":"OperaGX","author":"Hawk","version":"1.2","description":"A highly customizable theme based off of the OperaGX browser.","category":"gaming","bgImage":null,"accentColor":"#10b981","bgColor":"#111827","sizeKb":19},{"id":"osx_theme_css","file":"OSX.theme.css","name":"OSX","author":"TheCommieAxolotl#0001","version":"1.0.1","description":"Bring the best and most memorable parts of MacOS and OSX into 1 theme","category":"modern","bgImage":null,"accentColor":"#346eca","bgColor":"#0f172a","sizeKb":2},{"id":"pios_theme_css","file":"piOS.theme.css","name":"piOS","author":"Saltssaumure","version":"9.7","description":"A SUPERHOT piOS inspired theme.","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":1},{"id":"purpleonyx_theme_css","file":"PurpleOnyx.theme.css","name":"PurpleOnyx","author":"Zacam","version":"2.0.9","description":"Purple Accented NewUI Onyx Compact","category":"dark","bgImage":null,"accentColor":"#a855f7","bgColor":"#090a0f","sizeKb":3},{"id":"pyrite_theme_css","file":"pyrite.theme.css","name":"Pyrite - BetterDiscord","author":"LeafyLuigi","version":"0.2.8","description":"Pyrite for BetterDiscord.","category":"general","bgImage":"https://leafyluigi.github.io/images/pexels-josh-sorenson-116359.png","accentColor":"#5865F2","bgColor":"#111214","sizeKb":15},{"id":"quiet_theme_css","file":"Quiet.theme.css","name":"Quiet","author":"Izy","version":"2.0","description":"Dark and Quiet. Easy on the eyes.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":2},{"id":"radialstatus_theme_css","file":"RadialStatus.theme.css","name":"RadialStatus","author":"Gibbu#1211","version":"2.0.0","description":"Changes the status icons to wrap around the avatar. Shape can be changed inside the theme file.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":2},{"id":"rosynight_theme_css","file":"RosyNight.theme.css","name":"RosyNight","author":"DevEvil","version":"RN.1","description":"A sleek and elegant theme blending deep blacks with soft rosy hues for a stunning night-time aesthetic.","category":"dark","bgImage":null,"accentColor":"#f43f5e","bgColor":"#090a0f","sizeKb":1},{"id":"roundeddiscord_theme_css","file":"RoundedDiscord.theme.css","name":"Rounded Discord","author":"MarkChan0225","version":"1.1.1","description":"A theme which make your Discord becomes rounded","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":0},{"id":"roundmoled_theme_css","file":"roundmoled.theme.css","name":"Roundmoled","author":"Malasangre#4444","version":"1.1","description":"Simple amoled black + rounded corners theme","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"roundmoledv2_theme_css","file":"roundmoledV2.theme.css","name":"RoundmoledV2","author":"theoewzzer (Original Author: Malasangre#4444)","version":"1.3.1","description":"Simple amoled black + rounded corners theme - Updated version","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#2a2b2f","sizeKb":52},{"id":"servercolumns_theme_css","file":"ServerColumns.theme.css","name":"ServerColumns","author":"DevilBro","version":"1.0.6","description":"Changes the Server List to a grid-like Structure which allows any Amount of Columns","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"shine_theme_css","file":"shine.theme.css","name":"Shine","author":"Blade0, Zeealeid","version":"1.2","description":"Glossy, glassy theme based on a twitter design.","category":"glass","bgImage":null,"accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":1},{"id":"simplify_theme_css","file":"simplify.theme.css","name":"Simplify","author":"Ashtrath","version":"1.0.0","description":"Simple Clean looking theme with blue colors.","category":"minimal","bgImage":null,"accentColor":"#94a3b8","bgColor":"#1c223a","sizeKb":10},{"id":"skeuocord_theme_css","file":"SkeuoCord.theme.css","name":"SkeuoCord","author":"Marda33","version":"Auto Update","description":"A complete skeuomorphic overhaul for Discord.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":7},{"id":"sleekcord_theme_css","file":"SleekCord.theme.css","name":"Sleekcord","author":"TNT4ME","version":"4","description":"A pitch black theme that's sleek and modern in every way.","category":"dark","bgImage":"https://raw.githubusercontent.com/rose-pine/wallpapers/refs/heads/main/illustration/block-wave-moon.png","accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":3},{"id":"softx_theme_css","file":"SoftX.theme.css","name":"SoftX","author":"Gibbu","version":"2.0.0","description":"A soft and comfy feel for Discord.","category":"general","bgImage":"https://i.imgur.com/Nglfni6.png","accentColor":"#5865F2","bgColor":"#111214","sizeKb":3},{"id":"spectra_theme_css","file":"spectra.theme.css","name":"Spectra","author":"Pix","version":"1.1","description":"A dark theme letting the light shine through! Spectra is a visability focused theme that is still light on your eyes.","category":"dark","bgImage":null,"accentColor":"#6366f1","bgColor":"#090a0f","sizeKb":1},{"id":"spotify-discord_theme_css","file":"Spotify-Discord.theme.css","name":"Spotify Discord","author":"CapnKitten","version":"2.0.0","description":"Combine Discord and Spotify into one","category":"gaming","bgImage":null,"accentColor":"#10b981","bgColor":"#111827","sizeKb":3},{"id":"surcord_theme_css","file":"surCord.theme.css","name":"surCord","author":"Vozer","version":"06.2025","description":"A Discord theme inspired by Human Design.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":3},{"id":"synthesis_theme_css","file":"Synthesis.theme.css","name":"Synthesis","author":"Saltssaumure","version":"1.8","description":"A vibrant neon synthwave theme.","category":"cyberpunk","bgImage":"https://saltssaumure.github.io/synthesis-discord-theme/backgrounds/default.avif","accentColor":"#00f0ff","bgColor":"#0d0d15","sizeKb":1},{"id":"system24_theme_css","file":"system24.theme.css","name":"system24","author":"refact0r","version":"2.1.0","description":"a tui-style discord theme.","category":"modern","bgImage":null,"accentColor":"#3b82f6","bgColor":"#0f172a","sizeKb":9},{"id":"t1_theme_css","file":"T1.theme.css","name":"T1","author":"Eight_P","version":"0.11.0","description":"Simple design with focus on improvements and a horizontal server bar. 🛈 Edit the theme file for more options.","category":"minimal","bgImage":"https://eight-p.github.io/BD.8P/Themes/T1/assets/Main-bg.jpg","accentColor":"#94a3b8","bgColor":"#13141c","sizeKb":4},{"id":"tokyo-night_theme_css","file":"tokyo-night.theme.css","name":"Tokyo Night","author":"Ashtrath","version":"2.0.2","description":"Discord Port of Visual Studio Code Theme","category":"dark","bgImage":"https://dyzean.github.io/Tokyo-Night/addons/username-background.css","accentColor":"#7aa2f7","bgColor":"#1a1b26","sizeKb":6},{"id":"tokyo_midnight_theme_css","file":"tokyo_midnight.theme.css","name":"TokyoMidnight","author":"SnajperEXE","version":"v1.0","description":"Atmospheric mint-accented Discord theme inspired by midnight city lights, holographic interfaces, and futuristic terminal aesthetics.","category":"cyberpunk","bgImage":"https://snajperexe.github.io/TokyoMidnight/bgtm.png","accentColor":"#00f0ff","bgColor":"#0d0d15","sizeKb":3},{"id":"translucence_theme_css","file":"Translucence.theme.css","name":"Translucence","author":"CapnKitten","version":"2.0.0","description":"A translucent/frosted glass Discord theme","category":"glass","bgImage":"https://i.ibb.co/WNrbr1Yz/Alpine-Amnesia.png","accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":3},{"id":"tritone_theme_css","file":"Tritone.theme.css","name":"Tritone","author":"Saltssaumure","version":"2.5","description":"A tritone theme inspired by I Expect You To Die.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"uirefreshrefresh_theme_css","file":"UIRefreshRefresh.theme.css","name":"UI Refresh Refresh","author":"programmer2514","version":"1.7.0","description":"Enjoy Discord's UI refresh without the visual inconsistencies.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":9},{"id":"ultra_theme_css","file":"Ultra.theme.css","name":"Ultra","author":"TheCommieAxolotl#0001","version":"1.0.7","description":"A Smooth, Black theme","category":"dark","bgImage":null,"accentColor":"#6e6af6","bgColor":"#101014","sizeKb":2},{"id":"unity_theme_css","file":"Unity.theme.css","name":"Unity","author":"super.user","version":"1.5","description":"A highly customizable theme inspired by Samsung's OneUI","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":4},{"id":"glass_local_theme_css","file":"glass_local.theme.css","name":"Vibrant Glass","author":"Kaynooo#8080","version":"1.1","description":"Simple customizable glass theme.","category":"glass","bgImage":"https://cdn.discordapp.com/attachments/696040243748536401/850445513542205531/1-IrFMpUu.png","accentColor":"#38bdf8","bgColor":"#0f172a","sizeKb":2},{"id":"virtual-boy_theme_css","file":"virtual-boy.theme.css","name":"Virtual Boy","author":"Riddim_Glitch","version":"1.5","description":"A theme based on a failed Nintendo console with the same name.","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":1},{"id":"wildberry_theme_css","file":"Wildberry.theme.css","name":"Wildberry","author":"Daggy1234","version":"1.0.0","description":"Inspired by a Pop Tart flavour enjoy a berry inspired color storm for discord","category":"general","bgImage":null,"accentColor":"#5865F2","bgColor":"#111214","sizeKb":0},{"id":"wizardui_theme_css","file":"WizardUI.theme.css","name":"WizardUI","author":"NEBULYS","version":"1.91","description":"An amazing modular and fully customizable theme, made with 💖 by NEBULYS.","category":"general","bgImage":"https://goldenlys.github.io/WizardUI/images/backgrounds/nebula.jpg","accentColor":"#5865F2","bgColor":"#111214","sizeKb":6},{"id":"youtube_nation_theme_css","file":"Youtube_Nation.theme.css","name":"Youtube Nation","author":"ShadowDevilsAvenged","version":"4.4","description":"The Storage of All Videos","category":"gaming","bgImage":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_play_button_icon_%282013%E2%80%932017%29.svg/1200px-YouTube_play_button_icon_%282013%E2%80%932017%29.svg.png","accentColor":"#10b981","bgColor":"#111827","sizeKb":101}]};

  let themeDiagnostics = null;
  let lastAppliedAppTheme = localStorage.getItem('vh-theme') || 'dark';
  let activePresetFilter = 'all';
  let activePresetSearch = '';
  let presetDisplayLimit = 12;
  let themePreviewObserver = null;
  let activeTrialTheme = null;
  let activeThemeCss = '';
  let activeThemePresetId = null;
  let activeThemeDefaultBackground = '';

  function getStyleElement() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.dataset.source = 'local-user-theme';
      document.head.appendChild(style);
    }
    return style;
  }

  function getTrialStyleElement() {
    let style = document.getElementById(TRIAL_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = TRIAL_STYLE_ID;
      style.dataset.source = 'trial-user-theme';
      document.head.appendChild(style);
    }
    return style;
  }

  function setStatus(message, tone) {
    const status = document.getElementById('custom-theme-status');
    if (status) {
      status.textContent = message;
      status.className = `text-[10px] font-bold whitespace-nowrap ${tone === 'error' ? 'text-red-400' : tone === 'active' ? 'text-emerald-400' : 'text-gray-500'}`;
    }
    const currentThemeLabel = document.getElementById('appearance-current-theme-label');
    if (currentThemeLabel) {
      currentThemeLabel.textContent = message || window.__fb('theme.original', 'التصميم الأصلي');
    }
  }

  function normalizeBackgroundValue(value) {
    const source = String(value || '').trim();
    const imageUrl = source.match(/url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/i)?.[1];
    return imageUrl ? `url("${imageUrl}")` : source.replace(/["']/g, '');
  }

  function themeOptionEntries(css) {
    const source = String(css || '');
    const entries = [...source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)]
      .map((match) => ({ name: match[1], value: match[2].trim() }));
    const variableBackgrounds = entries.filter(({ name, value }) =>
      /(image|wallpaper|modern.*bg|background-image)/i.test(name) && /url\(/i.test(value) && !/unset|none/i.test(value));
    const directImages = [...source.matchAll(/url\(\s*(["']?)(https?:\/\/[^"')]+)\1\s*\)/gi)]
      .map((match, index) => ({ name: window.__f('theme.bg_image', {n: index + 1}, `صورة خلفية ${index + 1}`), value: `url("${match[2]}")` }));
    const backgrounds = [...variableBackgrounds, ...directImages]
      .map(({ name, value }) => ({ name, value: normalizeBackgroundValue(value) }));
    const fonts = entries.filter(({ name, value }) =>
      /font(?:-name|-family|-primary|-display)?|main-font/i.test(name) && !/font-size|url\(/i.test(name + value));
    const codeFonts = entries.filter(({ name, value }) =>
      /code-font|font-code|font-mono|font-monospace/i.test(name) && !/font-size|url\(/i.test(name + value));
    const textColors = entries.filter(({ name, value }) =>
      /(text|foreground|font-color|color-text)/i.test(name) && /#(?:[\da-f]{3,8})\b|rgba?\(|hsla?\(/i.test(value));
    const unique = (items) => [...new Map(items.map((item) => [item.value, item])).values()];
    return { backgrounds: unique(backgrounds), fonts: unique(fonts), codeFonts: unique(codeFonts), textColors: unique(textColors) };
  }

  function colorToHex(value, fallback) {
    const hex = String(value || '').match(/#[\da-f]{3,8}/i)?.[0];
    if (hex) {
      if (hex.length === 4) return '#' + [...hex.slice(1)].map((c) => c + c).join('');
      return hex.slice(0, 7);
    }
    const rgb = String(value || '').match(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i);
    if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    return fallback;
  }

  function detectDefaultBackground(css, presetId) {
    const preset = getThemeById(presetId);
    if (preset?.bgImage) return normalizeBackgroundValue(`url("${preset.bgImage}")`);

    const backgroundRule = String(css || '').match(/(?:background(?:-image)?|--(?:background-image|wallpaper|app-background-image))\s*:\s*[^;{}]*url\(\s*(["']?)(https?:\/\/[^"')]+)\1\s*\)/i);
    if (backgroundRule?.[2]) return normalizeBackgroundValue(`url("${backgroundRule[2]}")`);

    return normalizeBackgroundValue(themeOptionEntries(css).backgrounds[0]?.value || '');
  }

  // ---- Foxy smart contrast auto-fixer ----
  // Detects text elements whose color is (almost) identical to their effective
  // background and forces a readable color, so themed UIs never hide text
  // behind same-color backgrounds. Previous fixes are reverted first so the
  // pass is always evaluated from a clean state (idempotent + theme-safe).
  const CONTRAST_FIX_ATTR = 'data-foxy-contrast-fixed';
  function parseRgb(c) {
    if (!c) return null;
    c = c.trim();
    if (c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)' || c === 'currentColor') return null;
    let m = c.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(x => x + x).join('');
      if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
      if (h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
      return null;
    }
    m = c.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(',').map(x => parseFloat(x));
      if (p.length >= 3) return [p[0], p[1], p[2], p.length >= 4 ? p[3] : 1];
    }
    return null;
  }
  function relLum(r, g, b) {
    const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastRatio(c1, c2) {
    const l1 = relLum(c1[0], c1[1], c1[2]);
    const l2 = relLum(c2[0], c2[1], c2[2]);
    const lo = Math.min(l1, l2), hi = Math.max(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function compositeBackground(el, cache) {
    if (cache && cache.has(el)) return cache.get(el);
    // Collect own bg + parent effective bg (cached) and composite
    const own = parseRgb(getComputedStyle(el).backgroundColor);
    let result;
    if (own) {
      // If own is opaque, it's the result
      const a = own.length === 4 ? own[3] : 1;
      if (a >= 0.99) result = [own[0], own[1], own[2], 1];
      else {
        const parent = el.parentElement;
        const parentBg = parent ? compositeBackground(parent, cache) : [12, 15, 22, 1];
        result = [own[0] * a + parentBg[0] * (1 - a), own[1] * a + parentBg[1] * (1 - a), own[2] * a + parentBg[2] * (1 - a), 1];
      }
    } else {
      const parent = el.parentElement;
      result = parent ? compositeBackground(parent, cache) : [12, 15, 22, 1];
    }
    if (cache) cache.set(el, result);
    return result;
  }
  function hasDirectText(el) {
    if (el.matches && el.matches('input, textarea, select')) {
      const v = el.value != null ? String(el.value) : "";
      const p = el.placeholder != null ? String(el.placeholder) : "";
      if (v.trim().length || p.trim().length) return true;
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent && n.textContent.trim().length) return true;
    }
    return false;
  }
  let _contrastFixLastRun = 0;
  let _contrastFixPending = false;
  let _contrastIdleId = 0;
  let _contrastTimerId = 0;
  function autoFixContrast() {
    // Only run when a custom theme is active — otherwise default palette is fine
    const hasTheme = document.body.classList.contains('foxy-custom-theme');
    // Always clean up previous fixes if theme was removed
    if (!hasTheme || document.body.classList.contains('mode-turbo')) {
      const prev = document.querySelectorAll(`[${CONTRAST_FIX_ATTR}]`);
      if (prev.length) prev.forEach(el => {
        const orig = el.getAttribute('data-foxy-contrast-orig');
        el.style.color = orig != null ? orig : '';
        el.removeAttribute(CONTRAST_FIX_ATTR);
        el.removeAttribute('data-foxy-contrast-orig');
      });
      return 0;
    }
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - _contrastFixLastRun < 500) return 0;
    _contrastFixLastRun = now;
    document.querySelectorAll(`[${CONTRAST_FIX_ATTR}]`).forEach(el => {
      const orig = el.getAttribute('data-foxy-contrast-orig');
      el.style.color = orig != null ? orig : '';
      el.removeAttribute(CONTRAST_FIX_ATTR);
      el.removeAttribute('data-foxy-contrast-orig');
    });
    // Strict threshold: only fix when text is genuinely invisible (almost same color)
    // WCAG AA is 4.5 — we intentionally use a much lower bar to avoid false positives
    // on muted/secondary text. 1.6 means "same color".
    const THRESHOLD = 1.65;
    let count = 0;
    const all = document.querySelectorAll('*');
    const cache = new Map();
    // Prime cache for body
    cache.set(document.body, parseRgb(getComputedStyle(document.body).backgroundColor) || [12, 15, 22, 1]);
    cache.set(document.documentElement, parseRgb(getComputedStyle(document.documentElement).backgroundColor) || [12, 15, 22, 1]);
    for (const el of all) {
      if (!hasDirectText(el)) continue;
      const cs = getComputedStyle(el);
      const fg = parseRgb(cs.color);
      if (!fg) continue;
      const bg = compositeBackground(el, cache);
      if (contrastRatio(fg, bg) < THRESHOLD) {
        const lum = relLum(bg[0], bg[1], bg[2]);
        const newColor = lum > 0.5 ? '#0b0b0c' : '#f4f5f7';
        el.setAttribute('data-foxy-contrast-orig', el.style.color || '');
        el.setAttribute(CONTRAST_FIX_ATTR, '1');
        el.style.setProperty('color', newColor, 'important');
        count++;
      }
    }
    if (count) console.info(`[Foxy Contrast] fixed ${count} low-contrast text element(s)`);
    return count;
  }
  function scheduleContrastFix() {
    if (document.body.classList.contains('mode-turbo')) return;
    if (_contrastFixPending) return;
    _contrastFixPending = true;
    const run = () => {
      _contrastFixPending = false;
      autoFixContrast();
    };
    if (typeof window.requestIdleCallback === 'function') {
      _contrastIdleId && cancelIdleCallback(_contrastIdleId);
      _contrastIdleId = requestIdleCallback(run, { timeout: 900 });
    } else {
      requestAnimationFrame(() => requestAnimationFrame(run));
    }
    clearTimeout(_contrastTimerId);
    _contrastTimerId = setTimeout(run, 700);
  }
  window.FoxyAutoContrast = { fix: autoFixContrast, schedule: scheduleContrastFix };
  // Wrap friends-tab switcher so newly-shown tab content is also contrast-fixed
  (function wrapFriendsTab() {
    const tryWrap = () => {
      if (typeof window.switchFriendsTab === 'function' && !window.switchFriendsTab._foxyWrapped) {
        const orig = window.switchFriendsTab;
        window.switchFriendsTab = function(tab) {
          const r = orig.apply(this, arguments);
          scheduleContrastFix();
          return r;
        };
        window.switchFriendsTab._foxyWrapped = true;
        return true;
      }
      return false;
    };
    if (!tryWrap()) {
      let tries = 0;
      const id = setInterval(() => { if (tryWrap() || ++tries > 30) clearInterval(id); }, 300);
    }
  })();

  function applyThemePreferences() {
    const selectedBackground = document.getElementById('custom-theme-background-select')?.value || '';
    const background = selectedBackground || activeThemeDefaultBackground;
    const font = document.getElementById('custom-theme-font-select')?.value || '';
    const codeFont = document.getElementById('custom-theme-code-font-select')?.value || '';
    const primaryText = document.getElementById('custom-theme-primary-text')?.value || '#ffffff';
    const mutedText = document.getElementById('custom-theme-muted-text')?.value || '#c4c9d1';
    const opacity = (Number(document.getElementById('custom-theme-opacity')?.value) || 38) / 100;
    const bgBrightness = Math.min(100, Math.max(15, Number(document.getElementById('custom-theme-bg-brightness')?.value) || 100));
    const bgDim = ((100 - bgBrightness) / 100).toFixed(3);
    const backgroundImageStyle = background
      ? `background-image:linear-gradient(rgba(0,0,0,${bgDim}),rgba(0,0,0,${bgDim})),${background} !important;background-size:cover !important;background-position:center !important;`
      : '';
    
    let style = document.getElementById('foxy-theme-preferences');
    if (!style) {
      style = document.createElement('style');
      style.id = 'foxy-theme-preferences';
      document.head.appendChild(style);
    }
    
    style.textContent = `body.foxy-custom-theme{--foxy-theme-panel-opacity:${opacity};--foxy-bg-brightness:${bgBrightness}%;--foxy-user-text-color:${primaryText};--foxy-user-muted-text:${mutedText};--cv-readable-text:${primaryText};--cv-readable-muted:${mutedText};${background ? `--app-background-image:${background};--background-image:${background};${backgroundImageStyle}` : ''}${font ? `--cv-foxy-font:${font};--main-font:${font};` : ''}${codeFont ? `--cv-foxy-code-font:${codeFont};--code-font:${codeFont};` : ''}}
body.foxy-custom-theme .home-card,body.foxy-custom-theme .glass,body.foxy-custom-theme .settings-tab-content,body.foxy-custom-theme .settings-preview-card,body.foxy-custom-theme .profile-popout,body.foxy-custom-theme .re-modal{background:rgba(30,33,40,var(--foxy-theme-panel-opacity,.38)) !important;}
body.foxy-custom-theme .discord-sidebar,body.foxy-custom-theme .discord-rail,body.foxy-custom-theme .sidebar-bottom,body.foxy-custom-theme .settings-sidebar{background:rgba(15,17,22,var(--foxy-theme-panel-opacity,.38)) !important;}
body.foxy-custom-theme .discord-main,body.foxy-custom-theme .discord-view,body.foxy-custom-theme .view-body,body.foxy-custom-theme #home-friends-panels{background-color:rgba(20,22,28,calc(var(--foxy-theme-panel-opacity,.38) * .35)) !important;}
body.foxy-custom-theme .view-header,body.foxy-custom-theme .home-view-header,body.foxy-custom-theme #settings-view-header{background:rgba(17,19,24,min(1,calc(var(--foxy-theme-panel-opacity,.38) * 1.8))) !important;}
body.foxy-custom-theme pre,body.foxy-custom-theme code,body.foxy-custom-theme .font-mono,body.foxy-custom-theme [class*="mono"]{font-family:var(--cv-foxy-code-font, Consolas, 'Fira Code', monospace) !important;}`;
    
    document.head.appendChild(style);
    document.body.classList.toggle('foxy-has-background-image', !!background || document.body.classList.contains('foxy-has-background-image'));
    localStorage.setItem(PREFS_KEY, JSON.stringify({ background: selectedBackground, font, codeFont, opacity, bgBrightness, primaryText, mutedText }));
    scheduleContrastFix();
  }

  function refreshThemeOptions(css) {
    const options = themeOptionEntries(css);
    const panel = document.getElementById('custom-theme-options');
    const bgWrap = document.getElementById('custom-theme-background-wrap');
    const fontWrap = document.getElementById('custom-theme-font-wrap');
    const codeFontWrap = document.getElementById('custom-theme-code-font-wrap');
    const opacityWrap = document.getElementById('custom-theme-opacity-wrap');
    const bgBrightnessWrap = document.getElementById('custom-theme-bg-brightness-wrap');
    const bgSelect = document.getElementById('custom-theme-background-select');
    const fontSelect = document.getElementById('custom-theme-font-select');
    const codeFontSelect = document.getElementById('custom-theme-code-font-select');
    
    if (!panel || !bgSelect || !fontSelect) return;
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    const defaultBackground = normalizeBackgroundValue(activeThemeDefaultBackground);
    const backgroundOptions = options.backgrounds.filter(({ value }) => normalizeBackgroundValue(value) !== defaultBackground);

    // Populate Backgrounds
    bgSelect.innerHTML = '<option value="">' + window.__fb('theme.theme_default', 'الافتراضي من الثيم') + '</option>' + backgroundOptions.map(({ name, value }) => 
      `<option value="${value.replace(/"/g, '&quot;')}">${name.replace(/^--/, '').replace(/[-_]/g, ' ')}</option>`
    ).join('');
    
    // UI Fonts list
    const defaultUiFonts = [
      { name: window.__fb('theme.cairo_default', 'Cairo (الافتراضي)'), value: "'Cairo', sans-serif" },
      { name: 'Tajawal', value: "'Tajawal', sans-serif" },
      { name: 'Orbitron', value: "'Orbitron', sans-serif" },
      { name: 'Righteous', value: "'Righteous', cursive" },
      { name: 'Inter / System', value: "system-ui, -apple-system, sans-serif" }
    ];
    const combinedFonts = [...defaultUiFonts, ...options.fonts.map(f => ({ name: f.name.replace(/^--/, ''), value: f.value }))];
    fontSelect.innerHTML = combinedFonts.map(f => `<option value="${f.value.replace(/"/g, '&quot;')}">${f.name}</option>`).join('');

    // Code Fonts list
    if (codeFontSelect) {
      const defaultCodeFonts = [
        { name: window.__fb('theme.firacode_rec', 'Fira Code (موصى به)'), value: "'Fira Code', Consolas, monospace" },
        { name: "JetBrains Mono", value: "'JetBrains Mono', Consolas, monospace" },
        { name: "Consolas", value: "Consolas, 'Courier New', monospace" },
        { name: "Cascadia Code", value: "'Cascadia Code', monospace" }
      ];
      codeFontSelect.innerHTML = defaultCodeFonts.map(f => `<option value="${f.value.replace(/"/g, '&quot;')}">${f.name}</option>`).join('');
      if (saved.codeFont) codeFontSelect.value = saved.codeFont;
    }

    const savedBackground = normalizeBackgroundValue(saved.background || '');
    const savedBackgroundOption = backgroundOptions.find((item) => item.value === savedBackground);
    if (savedBackgroundOption) bgSelect.value = savedBackgroundOption.value;
    if (saved.font) fontSelect.value = saved.font;

    const textColors = options.textColors;
    const textColorsWrap = document.getElementById('custom-theme-text-colors');
    const primaryTextWrap = document.getElementById('custom-theme-primary-text-wrap');
    const mutedTextWrap = document.getElementById('custom-theme-muted-text-wrap');
    const primaryText = document.getElementById('custom-theme-primary-text');
    const mutedText = document.getElementById('custom-theme-muted-text');
    
    if (textColors.length) {
      const first = textColors[0];
      const second = textColors[1] || first;
      if (primaryText) primaryText.value = saved.primaryText || colorToHex(first.value, '#ffffff');
      if (mutedText) mutedText.value = saved.mutedText || colorToHex(second.value, '#c4c9d1');
      textColorsWrap?.classList.remove('hidden');
      primaryTextWrap?.classList.replace('hidden', 'flex');
      mutedTextWrap?.classList.replace('hidden', 'flex');
    }
    
    const opacity = document.getElementById('custom-theme-opacity');
    if (opacity && saved.opacity) opacity.value = Math.round(Number(saved.opacity) * 100);
    const bgBrightness = document.getElementById('custom-theme-bg-brightness');
    if (bgBrightness && saved.bgBrightness) bgBrightness.value = Math.round(Number(saved.bgBrightness));
    
    bgWrap?.classList.toggle('hidden', !backgroundOptions.length);
    bgWrap?.classList.toggle('flex', !!backgroundOptions.length);
    fontWrap?.classList.remove('hidden');
    fontWrap?.classList.add('flex');
    if (codeFontWrap) {
      codeFontWrap.classList.remove('hidden');
      codeFontWrap.classList.add('flex');
    }
    opacityWrap?.classList.remove('hidden');
    opacityWrap?.classList.add('flex');
    const hasBackground = !!defaultBackground || !!backgroundOptions.length;
    bgBrightnessWrap?.classList.toggle('hidden', !hasBackground);
    bgBrightnessWrap?.classList.toggle('flex', hasBackground);
    panel.classList.remove('hidden');
    applyThemePreferences();
  }

  function analyzeThemeTokens(css) {
    const source = String(css || '');
    const variables = [...source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)]
      .map((match) => ({ name: match[1], value: match[2].trim() }));
    const colorMatches = source.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || [];
    const colors = [...new Set(colorMatches.map((color) => color.trim()))].slice(0, 80);
    const knownColorVariables = variables.filter(({ name }) => /color|colour|background|accent|highlight|primary|text|rgb/i.test(name));
    const warnings = [];
    if (!knownColorVariables.length && !colors.length) warnings.push(window.__fb('theme.no_colors', 'لم يتم العثور على ألوان أو متغيرات ألوان واضحة.'));
    if (!variables.some(({ name }) => /rgb-highlight|main-color|primary1-colour|accent|background-image|background\b/i.test(name))) {
      warnings.push(window.__fb('theme.no_color_vars', 'لم يتم العثور على أسماء متغيرات معروفة؛ تم تطبيق التحويل الشامل للمحددات بنجاح.'));
    }
    return { variables: knownColorVariables.slice(0, 80), colors, warnings };
  }

  function setLog(entries) {
    const log = document.getElementById('custom-theme-log');
    const summary = document.getElementById('custom-theme-log-summary');
    if (!log || !summary) return;
    const adapted = entries.filter((entry) => entry.type === 'adapted').length;
    const missing = entries.filter((entry) => entry.type === 'missing').length;
    const conditional = entries.filter((entry) => entry.type === 'conditional').length;
    const external = entries.filter((entry) => entry.type === 'external').length;
    const skipped = entries.filter((entry) => entry.type === 'skipped').length;
    const diagnosticLines = themeDiagnostics ? [
      window.__fb('theme.diag_colors', '=== تشخيص الألوان ==='),
      window.__f('theme.vars_count', {n: themeDiagnostics.variables.length}, `متغيرات الألوان: ${themeDiagnostics.variables.length}`),
      themeDiagnostics.variables.map(({ name, value }) => `• ${name}: ${value}`).join('\n') || window.__fb('theme.no_vars_short', '• لا توجد متغيرات ألوان معروفة'),
      window.__f('theme.colors_found', {x: themeDiagnostics.colors.join(', ') || window.__fb('theme.none', 'لا يوجد')}, `ألوان مباشرة مستخرجة: ${themeDiagnostics.colors.join(', ') || window.__fb('theme.none', 'لا يوجد')}`),
      themeDiagnostics.warnings.length ? window.__f('theme.warns_list', {list: themeDiagnostics.warnings.map((warning) => `⚠ ${warning}`).join('\n')}, `تحذيرات:\n${themeDiagnostics.warnings.map((warning) => `⚠ ${warning}`).join('\n')}`) : window.__fb('theme.colors_ok', '✓ تم ضبط ألوان الثيم بنجاح'),
      window.__fb('theme.diag_selectors', '=== توافق المحددات ===')
    ].join('\n') : '';
    summary.textContent = window.__f('theme.scanned', {n: entries.length, a: adapted, m: missing, c: conditional, e: external, s: skipped}, `تم فحص ${entries.length} قاعدة: ${adapted} تحويل تلقائي، ${missing} غير موجودة، ${conditional} مشروطة، ${external} استيراد خارجي، ${skipped} متجاوزة لحماية التطبيق.`);
    log.textContent = `${diagnosticLines}${diagnosticLines ? '\n' : ''}${entries.map((entry) => {
      const prefix = entry.type === 'adapted' ? window.__fb('theme.fx_adapted', '✓ توافق تلقائي') : entry.type === 'missing' ? window.__fb('theme.fx_missing', '⚠ غير موجود حاليًا') : entry.type === 'conditional' ? window.__fb('theme.fx_cond', '○ مشروط بثيم Discord') : entry.type === 'external' ? window.__fb('theme.fx_ext', '↗ استيراد خارجي') : entry.type === 'skipped' ? window.__fb('theme.fx_skip', '↷ تم تجاوزه لخطأ صياغة') : window.__fb('theme.fx_other', '• مطبق');
      return `${prefix}: ${entry.selector}${entry.target ? `  →  ${entry.target}` : ''}`;
    }).join('\n')}`;
  }

  function splitSelectors(value) {
    const result = [];
    let start = 0;
    let depth = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(' || value[i] === '[') depth++;
      else if (value[i] === ')' || value[i] === ']') depth = Math.max(0, depth - 1);
      else if (value[i] === ',' && depth === 0) {
        result.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    result.push(value.slice(start).trim());
    return result.filter(Boolean);
  }

  function normalizeThemeSelector(selector) {
    let normalized = String(selector || '')
      .replace(/#app-mount\b/gi, 'body')
      .replace(/\.(?:visual-refresh|theme-dark|theme-light|theme-darker|theme-midnight)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || ':root';
  }

  function buildCompatibility(css) {
    const entries = [];
    const generated = [];
    const imports = css.match(/@import\s+[^;]+;/gi) || [];
    imports.forEach((rule) => entries.push({ type: 'external', selector: window.__f('theme.rule_ext', {rule}, `${rule} — محددات خارجية`) }));
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = rulePattern.exec(cleanCss))) {
      const rawSelector = match[1].trim();
      const declarations = match[2].trim();
      if (!rawSelector || rawSelector.startsWith('@') || !declarations) continue;
      if (/^(?:from|to|\d+(?:\.\d+)?%)$/i.test(rawSelector.trim())) continue;
      if (!hasBalancedCssQuotes(declarations)) {
        entries.push({ type: 'skipped', selector: rawSelector });
        continue;
      }
      splitSelectors(rawSelector).forEach((selector) => {
        let found = false;
        try { found = !!document.querySelector(selector); } catch (_) { }
        let adaptedSelector = rewriteLegacySelector(selector);
        if (!adaptedSelector.trim() || /^\s*[>+~]/.test(adaptedSelector)) adaptedSelector = ':root';
        if (found) {
          generated.push(`${scopeThemeSelector(selector)}{${declarations}}`);
          entries.push({ type: 'applied', selector });
          return;
        }
        let adaptedMatches = false;
        try { adaptedMatches = adaptedSelector !== selector && (adaptedSelector === ':root' || !!document.querySelector(adaptedSelector)); } catch (_) { }
        if (adaptedMatches) {
          generated.push(`${scopeThemeSelector(adaptedSelector)}{${declarations}}`);
          entries.push({ type: 'adapted', selector, target: adaptedSelector });
        } else if (/\.theme-(?:light|dark|darker|midnight)\b|:is\(/.test(selector)) {
          entries.push({ type: 'conditional', selector });
        } else {
          entries.push({ type: 'missing', selector });
        }
      });
    }

    const variableBridge = [];
    Object.entries(VARIABLE_ALIASES).forEach(([from, to]) => {
      if (new RegExp(`${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i').test(css)) {
        variableBridge.push(`${to}:var(${from})`);
      }
    });

    if (variableBridge.length) {
      const has = (name) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i').test(css);
      const extra = [];
      if (has('--rgb-highlight')) extra.push('--primary:rgb(var(--rgb-highlight))', '--primary-hover:rgb(var(--rgb-highlight))');
      if (has('--rgb-text')) extra.push('--text-main:rgb(var(--rgb-text))');
      if (has('--rgb-background')) extra.push('--bg-dark:rgb(var(--rgb-background))', '--main-bg:rgb(var(--rgb-background))');
      if (has('--rgb-close-button')) extra.push('--danger:rgb(var(--rgb-close-button))');
      if (has('--rgb-online-color')) extra.push('--success:rgb(var(--rgb-online-color))');
      generated.push(`:root{${variableBridge.concat(extra).join(';')}}`);
    }

    const hasVariable = (name) => new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i').test(css);
    const visualOverrides = [];
    const firstVariable = (names) => {
      const name = names.find(hasVariable);
      return name ? `var(${name})` : '';
    };
    const firstRgbVariable = (names) => {
      const name = names.find(hasVariable);
      return name ? `rgb(var(${name}))` : '';
    };

    const declarations = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)]
      .map((match) => ({ name: match[1], value: match[2].trim() }));
    const dynamicVariable = (include, exclude = []) => {
      const match = declarations.find(({ name, value }) => {
        const lowerName = name.toLowerCase();
        const lowerValue = value.toLowerCase();
        return include.some((word) => lowerName.includes(word))
          && !exclude.some((word) => lowerName.includes(word))
          && lowerValue !== 'initial'
          && lowerValue !== 'inherit'
          && !new RegExp(`var\\(\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`, 'i').test(value);
      });
      if (!match) return '';
      const isRgbValue = /^\s*\d+(?:\.\d+)?(?:\s*,\s*|\s+)\d+(?:\.\d+)?(?:\s*,\s*|\s+)\d+(?:\.\d+)?(?:\s*\/\s*[^)]+)?\s*$/.test(match.value);
      return isRgbValue ? `rgb(var(${match.name}))` : `var(${match.name})`;
    };

    const accent = hasVariable('--rgb-highlight')
      ? 'rgb(var(--rgb-highlight))'
      : firstVariable(['--main-color', '--primary1-colour', '--accent-color', '--brand-experiment', '--brand-experiment-560', '--brand-500'])
        || firstRgbVariable(['--synth-color-button', '--synth-color-pop', '--synth-color-foreground'])
        || dynamicVariable(['accent', 'highlight', 'primary', 'brand', 'button', 'link'], ['background', 'text']);
    
    const textColor = hasVariable('--rgb-text')
      ? 'rgb(var(--rgb-text))'
      : firstVariable(['--normal-text', '--text-normal', '--activetext-colour', '--header-primary'])
        || firstRgbVariable(['--synth-color-text'])
        || dynamicVariable(['text', 'foreground', 'font', 'content'], ['background', 'button']);
    
    const mutedText = firstVariable(['--muted-text', '--text-muted', '--interactive-normal', '--header-secondary'])
      || dynamicVariable(['muted', 'secondary-text', 'subtext'], ['background']);
    
    const background = hasVariable('--rgb-background')
      ? 'rgb(var(--rgb-background))'
      : firstVariable(['--background-primary', '--background-secondary'])
        || firstRgbVariable(['--synth-color-background'])
        || dynamicVariable(['background', 'surface', 'panel', 'canvas', 'base'], ['image', 'modifier', 'hover', 'active', 'selected', 'text']);
    
    const backgroundImage = firstVariable(['--app-background-image', '--background-image', '--wallpaper', '--synth-background-image']);

    if (accent || textColor || background) {
      const themeTokens = [];
      if (accent && accent !== 'var(--main-color)') themeTokens.push(`--main-color:${accent}`);
      if (accent) themeTokens.push(`--primary:${accent}`, `--primary-hover:${accent}`);
      if (textColor && textColor !== 'var(--normal-text)') themeTokens.push(`--normal-text:${textColor}`);
      if (textColor) themeTokens.push(`--text-main:${textColor}`);
      if (backgroundImage && backgroundImage !== 'var(--app-background-image)') themeTokens.push(`--app-background-image:${backgroundImage}`);
      if (themeTokens.length) generated.push(`body.foxy-custom-theme{${themeTokens.join(';')}}`);
      
      visualOverrides.push(`body.foxy-custom-theme{${background ? `background-color:${background} !important;` : ''}${textColor ? `color:${textColor} !important;` : ''}}`);
      if (background) visualOverrides.push(`body.foxy-custom-theme .discord-main,body.foxy-custom-theme .discord-view{background-color:${background} !important;}`);
      if (mutedText) visualOverrides.push(`body.foxy-custom-theme .text-gray-400:not([style*="color"]),body.foxy-custom-theme .text-gray-500:not([style*="color"]),body.foxy-custom-theme .text-slate-400:not([style*="color"]),body.foxy-custom-theme .text-zinc-400:not([style*="color"]){color:${mutedText} !important;}`);
      if (textColor) visualOverrides.push(`body.foxy-custom-theme .text-white:not([style*="color"]),body.foxy-custom-theme .text-gray-200:not([style*="color"]),body.foxy-custom-theme .text-gray-300:not([style*="color"]),body.foxy-custom-theme .sender-name:not([style*="color"]),body.foxy-custom-theme h1:not([style*="color"]),body.foxy-custom-theme h2:not([style*="color"]),body.foxy-custom-theme h3:not([style*="color"]),body.foxy-custom-theme label:not([style*="color"]){color:${textColor} !important;}`);
      if (accent) {
        visualOverrides.push(`body.foxy-custom-theme .bg-blue-500,body.foxy-custom-theme .bg-blue-600,body.foxy-custom-theme .bg-emerald-500,body.foxy-custom-theme .bg-emerald-600{background-color:${accent} !important;}`);
        visualOverrides.push(`body.foxy-custom-theme .text-blue-400,body.foxy-custom-theme .text-blue-500,body.foxy-custom-theme .text-emerald-400,body.foxy-custom-theme .text-emerald-500,body.foxy-custom-theme .border-blue-500,body.foxy-custom-theme .border-emerald-500{color:${accent} !important;border-color:${accent} !important;}`);
        visualOverrides.push(`body.foxy-custom-theme button:hover,body.foxy-custom-theme .hover\\:bg-blue-500:hover,body.foxy-custom-theme .hover\\:bg-emerald-500:hover{background-color:${accent} !important;}`);
      }
    }

    if (visualOverrides.length) generated.push(visualOverrides.join('\n'));
    generated.push(`body.foxy-clearvision-compat{--cv-foxy-bg-image:var(--app-background-image,none);background-image:var(--cv-foxy-bg-image);background-position:var(--background-position,center);background-size:var(--background-size,cover);}`);
    setLog(entries.slice(-250));
    return generated.join('\n');
  }

  async function inlineImportedThemes(css, seen = new Set()) {
    const importPattern = /@import\s+(?:url\(\s*)?["']?([^\s"')]+)["']?\s*\)?\s*;/gi;
    const imports = [...String(css || '').matchAll(importPattern)];
    let combined = String(css || '');
    
    for (const match of imports) {
      const sourceUrl = match[1];
      if (!sourceUrl) continue;
      
      // If it's a web font (Google Fonts / CDNFonts), load it via <link> tag natively (No CORS!)
      if (/fonts\.(?:googleapis|cdnfonts|gstatic)\.com/i.test(sourceUrl)) {
        try {
          let fontLink = document.querySelector(`link[href="${sourceUrl}"]`);
          if (!fontLink) {
            fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = sourceUrl;
            document.head.appendChild(fontLink);
          }
        } catch (_) { }
        combined = combined.replace(match[0], `/* Loaded font via link: ${sourceUrl} */`);
        continue;
      }

      // Safe clean removal of external BetterDiscord stylesheets to prevent browser CORS errors
      combined = combined.replace(match[0], `/* External layout stylesheet: ${sourceUrl} */`);
    }
    return combined;
  }

  function rewriteLegacySelector(selector) {
    let rewritten = normalizeThemeSelector(selector)
      .replace(/\.(?:[a-z-]+)_[a-z0-9]{5,}\b/gi, (token) => {
        const stem = token.slice(1).split('_')[0].toLowerCase();
        const aliases = {
          app: 'discord-layout', appmount: 'discord-body',
          guilds: 'discord-rail', guild: 'rail-servers',
          sidebar: 'discord-sidebar', chat: 'discord-main',
          messages: 'chat-messages-container', message: 'message-item',
          scroller: 'custom-scroll', channels: 'server-channels-list',
          channel: 'server-channel-item', members: 'members-list-container',
          member: 'participant-card', header: 'view-header',
          popout: 'profile-popout', modal: 're-modal',
          textarea: 'chat-input-container', search: 'search-input',
          input: 'input', button: 'button', wrapper: 'glass'
        };
        return aliases[stem] ? `.${aliases[stem]}` : token;
      });

    rewritten = rewritten.replace(ROOT_THEME_CLASSES, '');
    Object.entries(SELECTOR_ALIASES).forEach(([from, to]) => {
      rewritten = rewritten.replace(new RegExp(`\\.${from}(?![\\w-])`, 'g'), `.${to}`);
    });
    return rewritten.replace(/\s+/g, ' ').trim() || ':root';
  }

  function hasBalancedCssQuotes(value) {
    let single = 0, double = 0, escaped = false;
    for (const char of String(value || '')) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === "'") single++;
      if (char === '"') double++;
    }
    return single % 2 === 0 && double % 2 === 0;
  }

  function scopeThemeSelector(selector) {
    const normalized = rewriteLegacySelector(selector);
    if (normalized === ':root' || /^(?:html|body)\b/i.test(normalized)) {
      return normalized.replace(/^(?:html|body)\b/i, 'body.foxy-custom-theme');
    }
    return `body.foxy-custom-theme ${normalized}`;
  }

  function getPresetFallbackCss(css, presetId) {
    const preset = getThemeById(presetId) || {};
    const colors = String(css || '').match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || [];
    const accent = preset.accentColor || colors.find((color) => /^#/.test(color)) || '#5865f2';
    const background = preset.bgColor || '#111214';
    const image = preset.bgImage || (String(css || '').match(/url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/i) || [])[1] || '';
    const imageRule = image ? `background-image:linear-gradient(135deg,rgba(0,0,0,.82),rgba(0,0,0,.52)),url("${image}") !important;background-attachment:fixed !important;background-size:cover !important;background-position:center !important;` : '';

    // This bridge is intentionally scoped to Foxy's semantic classes and is
    // shared by every imported Discord/BetterDiscord theme.
    return `
      body.foxy-custom-theme{--foxy-theme-accent:${accent};--foxy-theme-bg:${background};background-color:${background} !important;${imageRule}}
      body.foxy-custom-theme .discord-main,body.foxy-custom-theme .discord-view,body.foxy-custom-theme .view-body,body.foxy-custom-theme #settings-tabs-content{background:rgba(0,0,0,.40) !important}
      body.foxy-custom-theme .discord-sidebar,body.foxy-custom-theme .discord-rail,body.foxy-custom-theme .sidebar-bottom,body.foxy-custom-theme .settings-sidebar{background:rgba(0,0,0,.76) !important;border-color:${accent}55 !important}
      body.foxy-custom-theme .home-card,body.foxy-custom-theme .glass,body.foxy-custom-theme .settings-tab-content,body.foxy-custom-theme .settings-preview-card,body.foxy-custom-theme .profile-popout,body.foxy-custom-theme .re-modal{background:rgba(0,0,0,.58) !important;border-color:${accent}66 !important;box-shadow:0 8px 28px rgba(0,0,0,.35) !important}
      body.foxy-custom-theme .view-header,body.foxy-custom-theme .home-view-header{background:rgba(0,0,0,.72) !important;border-color:${accent}66 !important}
      body.foxy-custom-theme button.bg-blue-500,body.foxy-custom-theme button.bg-blue-600,body.foxy-custom-theme button.bg-emerald-500,body.foxy-custom-theme button.bg-emerald-600,body.foxy-custom-theme .rail-btn-active,body.foxy-custom-theme .settings-nav-item.active{background:${accent} !important;border-color:rgba(255,255,255,.28) !important}
      body.foxy-custom-theme .server-channel-item:hover,body.foxy-custom-theme .server-channel-item-active,body.foxy-custom-theme .settings-nav-item:hover{background:${accent}33 !important;color:#fff !important}
      body.foxy-custom-theme .text-blue-400,body.foxy-custom-theme .text-blue-500,body.foxy-custom-theme .text-emerald-400,body.foxy-custom-theme .text-emerald-500{color:${accent} !important}
      body.foxy-custom-theme input:focus,body.foxy-custom-theme textarea:focus,body.foxy-custom-theme [contenteditable="true"]:focus{border-color:${accent} !important;box-shadow:0 0 0 2px ${accent}33 !important}
    `;
  }

  function extractImportedThemeVariables(css, selectedTheme = localStorage.getItem('vh-theme') || 'dark') {
    const variables = new Map();
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = rulePattern.exec(String(css || '')))) {
      const selector = match[1].trim().toLowerCase();
      const wantsLight = selectedTheme === 'light';
      const hasLight = selector.includes('theme-light');
      const hasDark = selector.includes('theme-dark') || selector.includes('theme-darker') || selector.includes('theme-midnight');
      const isLightNestedInDark = selector.includes('theme-dark .theme-light');
      if ((wantsLight && hasDark && !hasLight) || (!wantsLight && (isLightNestedInDark || (hasLight && !hasDark)))) continue;
      const declarations = match[2];
      for (const declaration of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)\s*;?/g)) {
        variables.set(declaration[1], declaration[2].trim());
      }
    }
    if (!variables.size) return '/* No safe theme variables found in imported stylesheet. */';
    return `:root{${[...variables].map(([name, value]) => `${name}:${value};`).join('')}}`;
  }

  async function applyCustomTheme(css, name, presetId) {
    if (!css || css.length > MAX_SIZE) return false;
    activeThemeCss = String(css);
    activeThemePresetId = presetId || null;
    activeThemeDefaultBackground = detectDefaultBackground(activeThemeCss, activeThemePresetId);
    document.body.classList.add('foxy-clearvision-compat', 'foxy-custom-theme');
    const expandedCss = await inlineImportedThemes(css);
    const hasBackgroundImage = /--(?:background-image|synth-background-image|app-background-image|wallpaper)\s*:\s*(?!unset\b|none\b)(?!var\([^)]*,\s*(?:none|unset)\s*\))[^;{}]+/i.test(expandedCss);
    document.body.classList.toggle('foxy-has-background-image', hasBackgroundImage);
    themeDiagnostics = analyzeThemeTokens(expandedCss);
    const compatibilityRules = buildCompatibility(expandedCss);
    const selectedTheme = localStorage.getItem('vh-theme') || 'dark';
    const safeThemeCss = extractImportedThemeVariables(expandedCss, selectedTheme);
    const presetFallbackCss = getPresetFallbackCss(expandedCss, presetId);
    getStyleElement().textContent = `/* Foxy isolated theme: ${String(name || 'custom').replace(/[\r\n*]/g, '')} */\n${safeThemeCss}\n/* Auto-generated Foxy compatibility rules */\n${compatibilityRules}\n/* Preset-specific Foxy compatibility */\n${presetFallbackCss}`;
    refreshThemeOptions(expandedCss);
    localStorage.setItem(STORAGE_KEY, css);
    localStorage.setItem(NAME_KEY, name || 'تصميم مخصص');
    if (presetId) localStorage.setItem(PRESET_ID_KEY, presetId);
    else localStorage.removeItem(PRESET_ID_KEY);
    setStatus(name || window.__fb('theme.custom', 'تصميم مخصص'), 'active');
    updatePresetCardsActiveState();
    scheduleContrastFix();
    return true;
  }

  function resetCustomTheme() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    getTrialStyleElement().remove();
    document.getElementById('foxy-theme-preferences')?.remove();
    document.body.classList.remove('foxy-clearvision-compat', 'foxy-custom-theme');
    document.body.classList.remove('foxy-has-background-image');
    themeDiagnostics = null;
    activeThemeCss = '';
    activeThemePresetId = null;
    activeThemeDefaultBackground = '';
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(PRESET_ID_KEY);
    localStorage.removeItem(PREFS_KEY);
    setLog([]);
    const summary = document.getElementById('custom-theme-log-summary');
    if (summary) summary.textContent = window.__fb('theme.restored', 'تمت استعادة التصميم الأصلي.');
    setStatus(window.__fb('theme.original', 'التصميم الأصلي'), 'default');
    hideLiveTrialBar();
    updatePresetCardsActiveState();
    if (typeof window.setAppTheme === 'function') window.setAppTheme('dark');
    if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('theme.restored2', 'تم استعادة التصميم الأصلي.'), 'success');
  }

  // ==========================================
  // PRESET THEMES LIBRARY & MODAL EXPLORER
  // ==========================================

  function getAllPresetThemes() {
    return PRESET_THEMES_MANIFEST.themes || [];
  }

  function getThemeById(id) {
    return getAllPresetThemes().find(t => t.id === id);
  }

  async function fetchThemeCss(theme) {
    try {
      const res = await fetch(`assets/themes/${encodeURIComponent(theme.file)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn('[Foxy Theme] Failed to fetch theme CSS file:', theme.file, err);
      return null;
    }
  }

  window.openThemesExplorerModal = function () {
    const modal = document.getElementById('themes-explorer-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    renderPresetThemes();
    updatePresetCardsActiveState();
    scheduleContrastFix();
  };

  window.closeThemesExplorerModal = function () {
    const modal = document.getElementById('themes-explorer-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  function updatePresetCardsActiveState() {
    const activePresetId = localStorage.getItem(PRESET_ID_KEY);
    const activeName = localStorage.getItem(NAME_KEY);
    const cards = document.querySelectorAll('.preset-theme-card');
    
    cards.forEach(card => {
      const cardId = card.dataset.themeId;
      const isCurrent = (activePresetId && cardId === activePresetId) || (activeName && card.dataset.themeName === activeName);
      card.classList.toggle('ring-2', isCurrent);
      card.classList.toggle('ring-emerald-400', isCurrent);
      card.classList.toggle('border-emerald-400/60', isCurrent);
      card.classList.toggle('shadow-emerald-500/20', isCurrent);
      
      const badge = card.querySelector('.active-theme-badge');
      const applyBtn = card.querySelector('.btn-apply-theme');
      if (badge) badge.classList.toggle('hidden', !isCurrent);
      if (applyBtn) {
        if (isCurrent) {
          applyBtn.textContent = window.__fb('theme.active_now', 'مفعّل الآن ✓');
          applyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-blue-500/25');
          applyBtn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/40', 'backdrop-blur-md');
        } else {
          applyBtn.textContent = window.__fb('theme.apply', 'تطبيق');
          applyBtn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-blue-500/25');
          applyBtn.classList.remove('bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/40', 'backdrop-blur-md');
        }
      }
    });

    const activeDisplay = document.getElementById('preset-theme-active-title');
    const explorerActivePill = document.getElementById('explorer-active-theme-pill');
    const nameToDisplay = activeName || window.__fb('theme.original', 'التصميم الأصلي');
    
    if (activeDisplay) {
      if (activePresetId || (activeName && activeName !== 'التصميم الأصلي')) {
        activeDisplay.textContent = window.__f('theme.active_theme', {name: nameToDisplay}, `الثيم النشط: ${nameToDisplay}`);
        activeDisplay.parentElement?.classList.remove('hidden');
        activeDisplay.parentElement?.classList.add('flex');
      } else {
        activeDisplay.parentElement?.classList.add('hidden');
        activeDisplay.parentElement?.classList.remove('flex');
      }
    }

    if (explorerActivePill) {
      explorerActivePill.textContent = nameToDisplay;
    }

    const currentBannerTitle = document.getElementById('appearance-banner-theme-name');
    if (currentBannerTitle) {
      currentBannerTitle.textContent = nameToDisplay;
    }
  }

  function hydrateThemePreviewImages(root) {
    if (!root) return;

    themePreviewObserver?.disconnect();
    themePreviewObserver = null;

    const previews = [...root.querySelectorAll('[data-preview-bg]')];
    if (!previews.length) return;

    const loadPreview = (preview) => {
      if (preview.dataset.previewLoaded === 'true') return;
      const encodedUrl = preview.dataset.previewBg;
      if (!encodedUrl) return;

      const url = decodeURIComponent(encodedUrl);
      const safeUrl = url.replace(/"/g, '\\"');
      preview.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%), url("${safeUrl}")`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.dataset.previewLoaded = 'true';
    };

    if (!('IntersectionObserver' in window)) {
      previews.forEach(loadPreview);
      return;
    }

    const scrollRoot = root.closest('.overflow-y-auto');
    themePreviewObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadPreview(entry.target);
        themePreviewObserver?.unobserve(entry.target);
      });
    }, { root: scrollRoot || null, rootMargin: '220px 0px' });

    previews.forEach(preview => themePreviewObserver.observe(preview));
  }

  function renderPresetThemes() {
    const container = document.getElementById('preset-themes-grid');
    const countDisplay = document.getElementById('preset-themes-count');
    const loadMoreBtn = document.getElementById('preset-themes-load-more');
    if (!container) return;
    themePreviewObserver?.disconnect();
    themePreviewObserver = null;

    const all = getAllPresetThemes();
    const filtered = all.filter(t => {
      const matchCat = activePresetFilter === 'all' || t.category === activePresetFilter;
      if (!matchCat) return false;
      if (!activePresetSearch) return true;
      const q = activePresetSearch.toLowerCase();
      return (t.name && t.name.toLowerCase().includes(q))
        || (t.author && t.author.toLowerCase().includes(q))
        || (t.description && t.description.toLowerCase().includes(q))
        || (t.category && t.category.toLowerCase().includes(q));
    });

    if (countDisplay) {
      countDisplay.textContent = window.__f('theme.showing', {a: Math.min(presetDisplayLimit, filtered.length), b: filtered.length}, `عرض ${Math.min(presetDisplayLimit, filtered.length)} من ${filtered.length} ثيم`);
    }

    const currentBatch = filtered.slice(0, presetDisplayLimit);

    if (currentBatch.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400 space-y-3 bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/10 p-8">
          <svg class="w-12 h-12 mx-auto text-gray-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p class="text-sm font-bold text-gray-200">${window.__f('theme.no_match', {q: activePresetSearch}, `لم يتم العثور على ثيمات مطابقة لـ "${activePresetSearch}"`)}</p>
          <p class="text-xs text-gray-400">${window.__fb('theme.no_match_hint', 'جرب البحث بكلمات أخرى أو اختر فئة مختلفة من الأعلى')}</p>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
      return;
    }

    container.innerHTML = currentBatch.map(theme => {
      const previewBg = theme.bgImage ? encodeURIComponent(theme.bgImage) : '';
      const bgStyle = theme.bgImage 
        ? 'background: #111214;'
        : `background: radial-gradient(circle at top right, ${theme.accentColor}33, transparent 65%), ${theme.bgColor || '#111214'};`;

      return `
        <div class="preset-theme-card group relative bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-blue-400/50 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between gap-3 transition-all duration-200 shadow-xl hover:shadow-blue-500/15" data-theme-id="${theme.id}" data-theme-name="${theme.name.replace(/"/g, '&quot;')}">
          <!-- Active Badge -->
          <div class="active-theme-badge hidden absolute top-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-emerald-400 text-black text-[10px] font-black tracking-wide shadow-lg shadow-emerald-500/30 flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
            <span>${window.__fb('theme.active_badge', 'مفعّل')}</span>
          </div>

          <!-- Realistic Mockup Preview Box -->
          <div class="theme-preview-box relative w-full h-28 rounded-xl overflow-hidden border border-white/15 group-hover:border-white/30 transition shadow-inner flex flex-col justify-between p-2 select-none" style="${bgStyle}" ${previewBg ? `data-preview-bg="${previewBg}"` : ''}>
            <!-- Mock Header -->
            <div class="flex items-center justify-between text-[9px] text-white/80">
              <div class="flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10">
                <span class="w-2 h-2 rounded-full shrink-0 shadow" style="background-color: ${theme.accentColor};"></span>
                <span class="font-bold truncate max-w-[100px]">${theme.name}</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-black/60 text-[8px] backdrop-blur-md text-gray-300 font-mono border border-white/10">v${theme.version || '1.0'}</span>
            </div>

            <!-- Mock UI Elements (Channels, Chat Bubble) -->
            <div class="flex items-center gap-1.5 h-full my-1">
              <!-- Mock Server rail -->
              <div class="w-4 h-full bg-black/50 backdrop-blur-md border border-white/10 rounded-lg flex flex-col items-center justify-center gap-1 py-1">
                <span class="w-2.5 h-2.5 rounded-full" style="background: ${theme.accentColor};"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-white/20"></span>
              </div>
              <!-- Mock Channels & Chat -->
              <div class="flex-1 h-full bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-1.5 flex flex-col justify-between text-[8px]">
                <div class="space-y-1">
                  <div class="w-16 h-1.5 rounded-full bg-white/40"></div>
                  <div class="w-24 h-1.5 rounded-full" style="background: ${theme.accentColor}dd;"></div>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded-full bg-white/50 shrink-0"></div>
                  <div class="flex-1 h-2 rounded bg-white/25"></div>
                </div>
              </div>
            </div>

            <!-- Palette Dots -->
            <div class="flex items-center justify-between text-[8px] text-gray-200 font-medium">
              <span class="truncate max-w-[120px] bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10">${theme.author}</span>
              <div class="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-md border border-white/15">
                <span class="w-2.5 h-2.5 rounded-full border border-white/30" style="background-color: ${theme.accentColor};" title="${window.__fb('theme.accent', 'لون التمييز')}"></span>
                <span class="w-2.5 h-2.5 rounded-full border border-white/30" style="background-color: ${theme.bgColor};" title="${window.__fb('theme.bgcolor', 'لون الخلفية')}"></span>
              </div>
            </div>

            <!-- Hover Preview Overlay Icon -->
            <div class="hidden absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[3px]">
              <span class="px-3.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xl border border-white/20 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ${window.__fb('theme.live_preview', 'معاينة حية')}
              </span>
            </div>
          </div>

          <!-- Theme Details -->
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-xs font-black text-white truncate group-hover:text-blue-300 transition" title="${theme.name}">${theme.name}</h4>
              <span class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-gray-300 backdrop-blur-md shrink-0">${theme.sizeKb} KB</span>
            </div>
            <p class="text-[11px] text-gray-300 line-clamp-2 leading-relaxed h-7" title="${theme.description}">${theme.description}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 pt-1 border-t border-white/10">
            <button type="button" class="hidden flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-gray-200 hover:text-white border border-white/10 text-xs font-bold transition items-center justify-center gap-1.5 touch-manipulation backdrop-blur-md">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ${window.__fb('theme.preview_btn', 'معاينة')}
            </button>
            <button type="button" onclick="window.applyPresetTheme('${theme.id}')" class="btn-apply-theme flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/25 active:scale-95 touch-manipulation border border-blue-400/30">
              ${window.__fb('theme.apply', 'تطبيق')}
            </button>
          </div>
        </div>
      `;
    }).join('');

    hydrateThemePreviewImages(container);

    if (loadMoreBtn) {
      if (filtered.length > presetDisplayLimit) {
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.textContent = window.__f('theme.show_more_left', {left: filtered.length - presetDisplayLimit}, `عرض المزيد من الثيمات (${filtered.length - presetDisplayLimit} متبقي)`);
      } else {
        loadMoreBtn.classList.add('hidden');
      }
    }

    updatePresetCardsActiveState();
  }

  // ==========================================
  // INTERACTIVE LIVE PREVIEW MODAL
  // ==========================================

  window.previewPresetTheme = function (themeId) {
    const theme = getThemeById(themeId);
    if (!theme) return;

    // Preview the selected theme on Foxy's real interface, not inside a mock window.
    window.closeThemesExplorerModal?.();
    window.closeThemePreviewModal?.();
    window.startLiveThemeTrial(themeId);
    return;

    const modal = document.getElementById('theme-preview-modal');
    if (!modal) return;

    // Fill Theme Info
    document.getElementById('theme-preview-title').textContent = theme.name;
    document.getElementById('theme-preview-author').textContent = window.__f('theme.by_version', {author: theme.author, ver: theme.version || '1.0'}, `بواسطة: ${theme.author} — الإصدار ${theme.version || '1.0'}`);
    document.getElementById('theme-preview-description').textContent = theme.description;
    
    const catBadge = document.getElementById('theme-preview-cat-badge');
    if (catBadge) {
      const catText = window.__fb('theme.cat_' + theme.category, PRESET_THEMES_MANIFEST.categories[theme.category] || theme.category);
      catBadge.textContent = catText;
    }

    // Set mockup styles
    const mockWindow = document.getElementById('theme-preview-mock-window');
    if (mockWindow) {
      if (theme.bgImage) {
        mockWindow.style.backgroundImage = `linear-gradient(180deg, rgba(10,12,18,0.7) 0%, rgba(10,12,18,0.92) 100%), url('${theme.bgImage}')`;
        mockWindow.style.backgroundSize = 'cover';
        mockWindow.style.backgroundPosition = 'center';
      } else {
        mockWindow.style.backgroundImage = 'none';
        mockWindow.style.backgroundColor = theme.bgColor || '#111214';
      }
    }

    // Swatches and Accent highlights
    const accentElements = modal.querySelectorAll('.theme-mock-accent');
    accentElements.forEach(el => {
      el.style.backgroundColor = theme.accentColor;
    });

    const accentTextElements = modal.querySelectorAll('.theme-mock-accent-text');
    accentTextElements.forEach(el => {
      el.style.color = theme.accentColor;
    });

    const accentBorderElements = modal.querySelectorAll('.theme-mock-accent-border');
    accentBorderElements.forEach(el => {
      el.style.borderColor = theme.accentColor;
    });

    // Swatch chips
    const swatchesWrap = document.getElementById('theme-preview-swatches');
    if (swatchesWrap) {
      swatchesWrap.innerHTML = `
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/10">
          <span class="w-3.5 h-3.5 rounded-full border border-white/30" style="background-color: ${theme.accentColor}"></span>
          <span class="text-[11px] font-mono text-gray-200">${window.__fb('theme.accent_label', 'التمييز')}: ${theme.accentColor}</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/10">
          <span class="w-3.5 h-3.5 rounded-full border border-white/30" style="background-color: ${theme.bgColor}"></span>
          <span class="text-[11px] font-mono text-gray-200">${window.__fb('theme.bg_label', 'الخلفية')}: ${theme.bgColor}</span>
        </div>
        ${theme.bgImage ? `
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 backdrop-blur-md border border-blue-400/30 text-blue-300 text-[11px] font-bold">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            ${window.__fb('theme.custom_bg', 'خلفية فنية مخصصة')}
          </div>
        ` : ''}
      `;
    }

    // Modal action buttons
    const applyBtn = document.getElementById('theme-preview-apply-btn');
    if (applyBtn) {
      applyBtn.onclick = () => {
        window.applyPresetTheme(theme.id);
        window.closeThemePreviewModal();
      };
    }

    const trialBtn = document.getElementById('theme-preview-trial-btn');
    if (trialBtn) {
      trialBtn.onclick = () => {
        window.startLiveThemeTrial(theme.id);
        window.closeThemePreviewModal();
      };
    }

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
  };

  window.closeThemePreviewModal = function () {
    const modal = document.getElementById('theme-preview-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.add('hidden');
  };

  // ==========================================
  // APPLY PRESET THEME
  // ==========================================

  window.applyPresetTheme = async function (themeId) {
    const theme = getThemeById(themeId);
    if (!theme) return;

    setStatus(window.__f('theme.applying', {name: theme.name}, `جاري تطبيق ثيم ${theme.name}...`), 'active');
    const css = await fetchThemeCss(theme);
    if (!css) {
      setStatus(window.__fb('theme.load_fail', 'تعذر تحميل ملف الثيم'), 'error');
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__f('theme.load_fail_file', {file: theme.file}, `تعذر تحميل ملف الثيم: ${theme.file}`), 'error');
      return;
    }

    const applied = await applyCustomTheme(css, theme.name, theme.id);
    if (applied) {
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__f('theme.applied_ok', {name: theme.name}, `تم تطبيق ثيم "${theme.name}" بنجاح!`), 'success');
      hideLiveTrialBar();
    }
  };

  // ==========================================
  // LIVE THEME TRIAL MODE
  // ==========================================

  window.startLiveThemeTrial = async function (themeId) {
    const theme = getThemeById(themeId);
    if (!theme) return;

    const css = await fetchThemeCss(theme);
    if (!css) return;

    activeTrialTheme = { theme, originalCss: localStorage.getItem(STORAGE_KEY), originalName: localStorage.getItem(NAME_KEY), originalPreset: localStorage.getItem(PRESET_ID_KEY) };

    const expandedCss = await inlineImportedThemes(css);
    const compatibilityRules = buildCompatibility(expandedCss);
    const safeThemeCss = extractImportedThemeVariables(expandedCss, localStorage.getItem('vh-theme') || 'dark');
    
    document.body.classList.add('foxy-clearvision-compat', 'foxy-custom-theme');
    getTrialStyleElement().textContent = `/* Live Trial: ${theme.name} */\n${safeThemeCss}\n${compatibilityRules}`;

    showLiveTrialBar(theme);
    if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__f('theme.trial_mode', {name: theme.name}, `أنت الآن في وضع المعاينة الحية لثيم "${theme.name}"`), 'info');
  };

  function showLiveTrialBar(theme) {
    let bar = document.getElementById('theme-live-trial-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'theme-live-trial-bar';
      bar.className = 'fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 w-[94%] max-w-lg z-[999999] bg-[#0c0f17]/85 backdrop-blur-2xl border border-white/20 px-4 py-3 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(59,130,246,0.2)] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300';
      document.body.appendChild(bar);
    }

    bar.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
        <span class="text-xs font-bold text-white truncate">${window.__fb('theme.trial_title', 'معاينة حية:')} <span class="text-blue-400 font-black">${theme.name}</span></span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" onclick="window.commitLiveThemeTrial()" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition shadow-lg shadow-emerald-500/25 border border-emerald-400/30 touch-manipulation">
          ${window.__fb('theme.keep_theme', 'تثبيت الثيم ✓')}
        </button>
        <button type="button" onclick="window.cancelLiveThemeTrial()" class="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-gray-200 hover:text-white text-xs font-bold transition border border-white/10 backdrop-blur-md touch-manipulation">
          ${window.__fb('theme.cancel_x', 'إلغاء ✕')}
        </button>
      </div>
    `;
    bar.style.display = 'flex';
    bar.classList.remove('hidden');
  }

  function hideLiveTrialBar() {
    const bar = document.getElementById('theme-live-trial-bar');
    if (bar) bar.remove();
  }

  window.commitLiveThemeTrial = function () {
    if (!activeTrialTheme) return;
    const { theme } = activeTrialTheme;
    getTrialStyleElement().remove();
    activeTrialTheme = null;
    hideLiveTrialBar();
    window.applyPresetTheme(theme.id);
  };

  window.cancelLiveThemeTrial = function () {
    getTrialStyleElement().remove();
    if (activeTrialTheme && activeTrialTheme.originalCss) {
      applyCustomTheme(activeTrialTheme.originalCss, activeTrialTheme.originalName, activeTrialTheme.originalPreset);
    } else {
      resetCustomTheme();
    }
    activeTrialTheme = null;
    hideLiveTrialBar();
    if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('theme.cancel_trial', 'تم إلغاء المعاينة واستعادة التصميم السابق.'), 'default');
  };

  // ==========================================
  // INITIALIZATION & EVENT LISTENERS
  // ==========================================

  function handleFile(file) {
    if (!file) return;
    const isCss = file.type === 'text/css' || /\.css$/i.test(file.name);
    if (!isCss) {
      setStatus(window.__fb('theme.invalid_file', 'الملف غير صالح'), 'error');
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('theme.css_only', 'يرجى اختيار ملف CSS فقط.'), 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      setStatus(window.__fb('theme.file_too_big', 'الملف كبير جدًا'), 'error');
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('theme.size_limit', 'حجم ملف التصميم يجب ألا يتجاوز 512 كيلوبايت.'), 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setStatus(window.__fb('theme.analyzing', 'جاري تحليل التصميم...'), 'active');
      applyCustomTheme(String(reader.result || ''), file.name).then((applied) => {
        if (applied) {
          if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__f('theme.applied_file', {file: file.name}, `تم تطبيق التصميم: ${file.name}`), 'success');
        }
      }).catch(() => setStatus(window.__fb('theme.parse_fail', 'تعذر تحليل التصميم'), 'error'));
    };
    reader.onerror = () => setStatus(window.__fb('theme.read_fail', 'تعذر قراءة الملف'), 'error');
    reader.readAsText(file);
  }

  function init() {
    const themesModal = document.getElementById('themes-explorer-modal');
    if (themesModal) {
      themesModal.addEventListener('click', (event) => {
        if (event.target === themesModal) window.closeThemesExplorerModal();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && themesModal && !themesModal.hidden) {
        window.closeThemesExplorerModal();
      }
    });

    // Custom file upload and reset
    const input = document.getElementById('custom-theme-file');
    const reset = document.getElementById('custom-theme-reset');
    if (input) input.addEventListener('change', () => {
      handleFile(input.files && input.files[0]);
      input.value = '';
    });
    if (reset) reset.addEventListener('click', resetCustomTheme);

    // Custom theme preferences
    document.getElementById('custom-theme-background-select')?.addEventListener('change', applyThemePreferences);
    document.getElementById('custom-theme-font-select')?.addEventListener('change', applyThemePreferences);
    document.getElementById('custom-theme-code-font-select')?.addEventListener('change', applyThemePreferences);
    document.getElementById('custom-theme-opacity')?.addEventListener('input', applyThemePreferences);
    document.getElementById('custom-theme-bg-brightness')?.addEventListener('input', applyThemePreferences);
    document.getElementById('custom-theme-primary-text')?.addEventListener('input', applyThemePreferences);
    document.getElementById('custom-theme-muted-text')?.addEventListener('input', applyThemePreferences);

    // Search and Category Filters for Preset Themes
    const searchInput = document.getElementById('preset-themes-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        activePresetSearch = e.target.value.trim();
        presetDisplayLimit = 12;
        renderPresetThemes();
      });
    }

    const catButtons = document.querySelectorAll('.preset-cat-filter');
    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        catButtons.forEach(b => {
          b.classList.remove('bg-blue-600', 'text-white', 'border-blue-400/50', 'shadow-blue-500/30');
          b.classList.add('bg-white/[0.05]', 'text-gray-300', 'border-white/10');
        });
        btn.classList.add('bg-blue-600', 'text-white', 'border-blue-400/50', 'shadow-blue-500/30');
        btn.classList.remove('bg-white/[0.05]', 'text-gray-300', 'border-white/10');
        
        activePresetFilter = btn.dataset.category || 'all';
        presetDisplayLimit = 12;
        renderPresetThemes();
      });
    });

    const loadMoreBtn = document.getElementById('preset-themes-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        presetDisplayLimit += 12;
        renderPresetThemes();
      });
    }

    // Reapply saved theme on startup
    const savedCss = localStorage.getItem(STORAGE_KEY);
    if (savedCss) {
      lastAppliedAppTheme = localStorage.getItem('vh-theme') || 'dark';
      applyCustomTheme(savedCss, localStorage.getItem(NAME_KEY) || window.__fb('theme.custom', 'تصميم مخصص'), localStorage.getItem(PRESET_ID_KEY));
    }

    // Observer for mode changes
    new MutationObserver(() => {
      const currentCss = localStorage.getItem(STORAGE_KEY);
      const selectedTheme = localStorage.getItem('vh-theme') || 'dark';
      if (currentCss && selectedTheme !== lastAppliedAppTheme) {
        lastAppliedAppTheme = selectedTheme;
        applyCustomTheme(currentCss, localStorage.getItem(NAME_KEY) || window.__fb('theme.custom', 'تصميم مخصص'), localStorage.getItem(PRESET_ID_KEY));
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
