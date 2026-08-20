/**
 * Personal Website V2 — Main Entry
 * P3R-inspired Desktop Theme with 3D Character
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  async function init() {
    // 1. Particles (background, starts immediately — behind login)
    Particles.init();

    // 2. Sound system
    Sound.init();

    // 3. Theme Manager (restore saved theme + lang)
    ThemeManager.init();

    // 4. Login Screen (blocks interaction until dismissed)
    await Login.init();

    // 4. Desktop (icons, selection, context menu)
    Desktop.init();

    // Interactive discovery layer in the open Academy panel area.
    MemoryNetwork.init();

    // 5. Window Manager (window creation/drag/resize)
    WindowManager.init();

    // 6. Taskbar (start menu, clock, toggles)
    Taskbar.init();
    TicketVerifier.init();

    // 7. Character Engine 2.0. Wait until a healthy idle state exists before
    // chat and reactions are enabled.
    await Character.init();

    // 8. Chat
    Chat.init();

    // 9. Easter Eggs
    EasterEggs.init();

    // Full-achievement visitor ticket reward.
    AchievementReward.init();

    // Live floor telemetry and contextual memory preview.
    FieldConsole.init();

    // 10. Update taskbar egg counter
    Taskbar.updateEggCounter();

    showWelcome();
    setupGlobalListeners();

    // Brief greeting after both the entry gate and Character Engine are ready.
    setTimeout(() => {
      if (Character.loaded && !sessionStorage.getItem('greeted_v2')) {
        sessionStorage.setItem('greeted_v2', 'true');
        Character.playAnimation?.('greeting', { state: 'greeting' });
        const msg = currentLang === 'zh'
          ? '欢迎进入 Academy City。想聊天的话，连接我旁边的 Mental Link。'
          : 'Welcome to Academy City. Open Mental Link beside me if you want to chat.';
        Character.say(msg, 4800);
      }
    }, 700);

    console.log('🚀 Personal Universe v2 ready — P3R x Shokuhou Misaki');
  }

  function showWelcome() {
    // Handled by login dismissal now
  }

  function setupGlobalListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const moduleKeys = {
        Digit1: 'about', Digit2: 'timeline', Digit3: 'works',
        Digit4: 'changelog', Digit5: 'contact', Digit6: 'signal',
      };
      if (e.ctrlKey && moduleKeys[e.code]) {
        e.preventDefault();
        EventBus.emit('desktop:open-window', moduleKeys[e.code]);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
