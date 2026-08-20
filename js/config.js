/* ───────── i18n ───────── */
const I18N = {
  zh: {
    about: '关于我',
    timeline: '游戏与番剧',
    works: '作品集',
    changelog: '关于本站',
    contact: '留言',
    signal: '最近在做',
    start: '开始',
    refresh: '刷新',
    newWindow: '新建窗口',
    changeWallpaper: '换壁纸',
    aboutSite: '关于本站',
    settings: '设置',
    easterEggs: '成就档案',
    langLabel: '中',
    themeDay: '☀️',
    themeNight: '🌙',
    windowMin: '最小化',
    windowMax: '最大化',
    windowClose: '关闭',
    submit: '发送',
    sendMessage: '留言',
    chatPlaceholder: '说点什么...',
    cmdPlaceholder: '输入指令...',
    eggFound: '成就解锁',
    onlineTooLong: '你已经在线1小时了，休息一下吧~',
    hourlyReport: '现在时间是',
    loading: '加载中...',
    submitSuccess: '发送成功！',
    submitFail: '发送失败，请稍后重试',
    submitFrequent: '操作太频繁，请稍后再试',
    emptyField: '内容不能为空',
    nameLabel: '你的名字（称呼）',
    namePlaceholder: '最多10个字符',
    contactLabel: '你的联系方式（邮箱、QQ、电话等）',
    contactPlaceholder: '最多30个字符',
    messageLabel: '你的留言',
    messagePlaceholder: '最多1000个字符',
    toLabel: '收件人',
    charLimit: '字符限制',
    // Character preset replies
    charReplies: {
      '你好': '你好呀！欢迎来到我的桌面~ ✨ 有什么想了解的吗？',
      '你是谁': '我是食蜂操祈，这台电脑的桌面精灵~ 负责陪你聊天、介绍这个网站，偶尔捣捣乱 (｡･ω･｡)',
      '你会什么': '我会帮忙介绍这个网站的各个模块，陪你聊天，偶尔讲个笑话。对了，试试在桌面上右键看看？或者按 Ctrl+K 打开命令行～',
      '讲个笑话': '为什么程序员总是分不清万圣节和圣诞节？\n因为 Oct 31 == Dec 25！\n……不好笑吗？(◞‸◟)',
      '再见': '拜拜~ 我就在这里，随时等你回来哦 👋✨',
      '现在几点': '抬头看右下角！我帮你准备好了时钟~',
      '我爱你': '……（脸红）\n那个……要看看我的作品集吗？（迅速转移话题）',
    },
  },
  en: {
    about: 'About Me',
    timeline: 'Timeline',
    works: 'Portfolio',
    changelog: 'About Site',
    contact: 'Contact',
    signal: 'Current Signal',
    start: 'Start',
    refresh: 'Refresh',
    newWindow: 'New Window',
    changeWallpaper: 'Change Wallpaper',
    aboutSite: 'About This Site',
    settings: 'Settings',
    easterEggs: 'Achievements',
    langLabel: 'EN',
    themeDay: '☀️',
    themeNight: '🌙',
    windowMin: 'Minimize',
    windowMax: 'Maximize',
    windowClose: 'Close',
    submit: 'Send',
    sendMessage: 'Send Message',
    chatPlaceholder: 'Say something...',
    cmdPlaceholder: 'Type a command...',
    eggFound: 'Achievement Unlocked',
    onlineTooLong: "You've been here for an hour. Time for a break~",
    hourlyReport: "It's",
    loading: 'Loading...',
    submitSuccess: 'Sent successfully!',
    submitFail: 'Failed to send. Please try again later.',
    submitFrequent: 'Too frequent. Please wait a moment.',
    emptyField: 'Cannot be empty',
    nameLabel: 'Your Name',
    namePlaceholder: 'Max 10 characters',
    contactLabel: 'Your Contact (Email/QQ/Phone)',
    contactPlaceholder: 'Max 30 characters',
    messageLabel: 'Your Message',
    messagePlaceholder: 'Max 1000 characters',
    toLabel: 'To',
    charLimit: 'char limit',
    charReplies: {
      'hello': 'Hello! Welcome to my desktop~ ✨ What would you like to know?',
      'hi': 'Hey there! Feel free to explore — click around, drag things, it\'s all interactive~',
      'who are you': "I'm Shokuhou Misaki, this computer's desktop fairy~ I chat with visitors, introduce the site, and occasionally cause mischief (｡･ω･｡)",
      'what can you do': 'I can show you around the site, chat with you, and tell a joke or two. Oh, try right-clicking the desktop or pressing Ctrl+K for a command line~',
      'tell me a joke': "Why do programmers prefer dark mode?\nBecause light attracts bugs!\n...I'll see myself out. (◞‸◟)",
      'goodbye': 'Bye bye~ I\'ll be right here when you come back 👋✨',
      'what time is it': 'Bottom right corner! I keep the clock running just for you~',
      'i love you': '... (blushes) \nA-anyway, want to check out my portfolio? (swiftly changes topic)',
    },
  },
};

/* ───────── Desktop Icons ───────── */
const DESKTOP_ICONS = [
  { id: 'about',    label: '关于我',  labelEn: 'About Me',  icon: '01', windowType: 'about' },
  { id: 'timeline', label: '游戏与番剧', labelEn: 'Archive', icon: '02', windowType: 'timeline' },
  { id: 'works',    label: '作品集',  labelEn: 'Portfolio', icon: '03', windowType: 'works' },
  { id: 'changelog',label: '关于本站', labelEn: 'About Site',icon: '04', windowType: 'changelog' },
  { id: 'contact',  label: '留言',    labelEn: 'Contact',  icon: '05', windowType: 'contact' },
  { id: 'signal',   label: '最近在做', labelEn: 'Now',      icon: '06', windowType: 'signal' },
];

/* ───────── Start Menu Items ───────── */
const START_MENU_ITEMS = [
  { id: 'mentalLink', icon: 'AI', action: 'openChat', label: 'Mental Link', labelEn: 'Mental Link' },
  { id: 'terminal', icon: '>_', action: 'terminal', label: '命令终端', labelEn: 'Terminal' },
  { id: 'achievements', icon: '◆', action: 'achievements', label: '成就档案', labelEn: 'Achievements' },
  { id: 'ticketVerify', icon: '✓', action: 'ticketVerify', label: '访问票检票', labelEn: 'Verify Ticket' },
  { id: 'sound', icon: '♪', action: 'toggleSound', label: '关闭音效', labelEn: 'Mute Sounds' },
  { id: 'fullscreen', icon: '[]', action: 'fullscreen', label: '沉浸模式', labelEn: 'Immersive Mode' },
];

/* ───────── Easter Egg Definitions ───────── */
const EASTER_EGGS = {
  identityDecoded: {
    name: '身份解码',
    nameEn: 'Identity Decoded',
    type: 'identity',
    icon: '◉',
    hint: '读取了身份原子核与三项技能电子',
    lockedHint: '身份档案中的轨道等待解码',
  },
  starDivination: {
    name: '星空占卜',
    nameEn: 'Star Divination',
    icon: '🔮',
    hint: '完成了一次星空观测',
    lockedHint: '终端中存在一项星空协议',
  },
  fullscreen: {
    name: '沉浸模式',
    nameEn: 'Immersive Mode',
    icon: '🎬',
    hint: '进入过沉浸观测模式',
    lockedHint: '尝试从开始菜单改变观察方式',
  },
  firstCommand: {
    name: '首条指令',
    nameEn: 'First Command',
    type: 'terminal',
    icon: '>_',
    hint: '成功执行了第一条终端指令',
    lockedHint: '终端正在等待一条有效指令',
  },
  characterAnnoyed: {
    name: '别点啦！',
    nameEn: 'Stop Poking!',
    type: 'character',
    icon: '😤',
    hint: '触发了食蜂操祈的真实反应',
    lockedHint: '角色似乎不喜欢被连续打扰',
  },
  summonCat: {
    name: '猫咪协议', nameEn: 'Cat Protocol', type: 'terminal', icon: '🐱',
    hint: '启动了终端中的电子猫巡检协议',
    lockedHint: '一项有生命的协议藏在终端里',
  },
};

/* The complete achievement archive is intentionally limited to six records;
 * the visitor ticket and the central trophy use the same 06 / 06 contract. */
const CORE_ACHIEVEMENT_IDS = [
  'identityDecoded',
  'starDivination',
  'fullscreen',
  'firstCommand',
  'characterAnnoyed',
  'summonCat',
];

const ACHIEVEMENT_TICKETS = [
  { id: 'classic', label: '经典', labelEn: 'Classic', src: 'assets/images/tickets/ticket-classic.png' },
  { id: 'welcome', label: '入场邀请', labelEn: 'Welcome', src: 'assets/images/tickets/ticket-welcome.png' },
  { id: 'mentalout', label: 'Mental Out', labelEn: 'Mental Out', src: 'assets/images/tickets/ticket-mentalout.png' },
  { id: 'encore', label: '谢幕致意', labelEn: 'Encore', src: 'assets/images/tickets/ticket-encore.png' },
];

/* ───────── Default Settings ───────── */
const DEFAULT_SETTINGS = {
  lang: 'zh',           // 'zh' | 'en'
};

/* ───────── Particle Config ───────── */
const PARTICLE_CONFIG = {
  count: 120,           // base count, scales with tiers
  linkThreshold: 160,
  mouseLinkThreshold: 200,
  baseSpeed: 0.5,
  particleRadius: 2.8,  // star outer radius
  glowBlur: 12,
  coloredDotRadius: 4.0,
  coloredDotCount: { min: 6, max: 8 },
  coloredDotRespawnMs: { min: 30000, max: 60000 },
  starSpikes: 5,
};

/* ───────── Window Config ───────── */
const WINDOW_CONFIG = {
  minWidth: 300,
  minHeight: 200,
  defaultWidth: 650,
  defaultHeight: 500,
  snapThreshold: 50,
  timelineWidth: 940,
  timelineHeight: 610,
};

/* ───────── Character Config ───────── */
const CHARACTER_CONFIG = {
  modelPath: 'shokuhou.vrm',
  fallbackImage: 'assets/images/avatar.jpg',
  position: { x: 0.82, y: 0.72 }, // percentage of desktop
  scale: 1.0,
  idleSwitchInterval: 15000,  // ms between idle pose switches
  wanderInterval: 60000,      // ms before character wanders

};

// Replace the obsolete historic animation table above with the reviewed set.
// Keeping the assignment separate also makes the actual runtime contract easy
// to audit while old documentation is being retired.
CHARACTER_CONFIG.animations = {
  angry: { file: 'assets/animations/character/angry.vrma', loop: false, weight: 1, crossfadeIn: 0.28, crossfadeOut: 0.5 },
  clapping: { file: 'assets/animations/character/clapping.vrma', loop: false, weight: 1, crossfadeIn: 0.16, crossfadeOut: 0.28 },
  laughing: { file: 'assets/animations/character/laughing.vrma', loop: false, weight: 1, crossfadeIn: 0.28, crossfadeOut: 0.5 },
  greeting: { file: 'assets/animations/character/greeting.vrma', loop: false, weight: 1, crossfadeIn: 0.28, crossfadeOut: 0.5 },
  talking: { file: 'assets/animations/character/talking.vrma', loop: false, weight: 1, crossfadeIn: 0.24, crossfadeOut: 0.42 },
  thinking: { file: 'assets/animations/character/thinking.vrma', loop: false, weight: 1, crossfadeIn: 0.28, crossfadeOut: 0.48 },
  yawn: { file: 'assets/animations/character/yawn.vrma', loop: false, weight: 1, crossfadeIn: 0.38, crossfadeOut: 0.65 },
  tsundere: { file: 'assets/animations/character/tsundere.vrma', loop: false, weight: 1, crossfadeIn: 0.3, crossfadeOut: 0.55 },
};
