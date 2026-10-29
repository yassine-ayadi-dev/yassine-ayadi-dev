/**
 * Application Entry Point: Ties 3D Scene, Audio Synth, and In-Scene Interactive Overlays together.
 * Faithfully recreating the experience shown in the video.
 */

import { audioManager, MusicTheme } from './audio.ts';
import { PortfolioScene } from './scene.ts';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvasContainer');
  if (!container) return;

  // Global UI elements
  const backToRoomBtn = document.getElementById('backToRoomBtn');
  const camResetBtn = document.getElementById('camResetBtn');
  const heroOverlayHud = document.getElementById('heroOverlayHud');
  const topBadgeLeft = document.getElementById('topBadgeLeft');
  const hotspotHint = document.getElementById('hotspotHint');
  const hintText = document.getElementById('hintText');
  const hudToast = document.getElementById('hudToast');
  const dockNavTabs = document.querySelectorAll<HTMLButtonElement>('.dock-nav-tab');

  // Music Player UI elements
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = document.getElementById('soundLabel');
  const musicVolumeSlider = document.getElementById('musicVolumeSlider') as HTMLInputElement | null;
  const themeChips = document.querySelectorAll<HTMLButtonElement>('.theme-chip');
  const spPlayBtn = document.getElementById('spPlayBtn');
  const spPlayIcon = document.getElementById('spPlayIcon');
  const spPlayText = document.getElementById('spPlayText');
  const spVolumeSlider = document.getElementById('spVolumeSlider') as HTMLInputElement | null;
  const spTrackTitle = document.getElementById('spTrackTitle');
  const spMoodBtns = document.querySelectorAll<HTMLButtonElement>('.sp-mood-btn');
  const phonePlayMusicIcon = document.getElementById('phonePlayMusicIcon');
  const phoneBackRoomIcon = document.getElementById('phoneBackRoomIcon');

  // Zoomed Views Overlays
  const views: Record<string, HTMLElement | null> = {
    projects: document.getElementById('viewProjects'),
    experience: document.getElementById('viewExperience'),
    about: document.getElementById('viewAbout'),
    contact: document.getElementById('viewContact'),
    audio: document.getElementById('viewAudio'),
  };

  let currentViewId: string | null = null;

  const showToast = (message: string): void => {
    if (!hudToast) return;
    hudToast.textContent = message;
    hudToast.classList.add('show');
    setTimeout(() => {
      hudToast.classList.remove('show');
    }, 2800);
  };

  // Switch to zoomed section view
  const switchToSection = (targetId: string): void => {
    currentViewId = targetId;
    audioManager.playClick(620);

    // Camera animation in 3D scene
    scene.selectSection(targetId);

    // Hide all views first
    Object.values(views).forEach((v) => {
      if (v) v.style.display = 'none';
    });

    // Show target view
    const targetView = views[targetId];
    if (targetView) {
      targetView.style.display = 'flex';
    }

    // UI State updates
    if (backToRoomBtn) backToRoomBtn.classList.add('visible');
    if (topBadgeLeft) topBadgeLeft.style.display = 'none';
    if (heroOverlayHud) heroOverlayHud.classList.add('hidden');
    if (hotspotHint) hotspotHint.style.opacity = '0';

    // Highlight bottom dock
    dockNavTabs.forEach((tab) => {
      if (tab.getAttribute('data-target') === targetId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  };

  // Return to Room Overview
  const returnToRoom = (): void => {
    currentViewId = null;
    audioManager.playClick(460);

    scene.resetCamera();

    // Hide all zoomed views
    Object.values(views).forEach((v) => {
      if (v) v.style.display = 'none';
    });

    // Restore overview HUD
    if (backToRoomBtn) backToRoomBtn.classList.remove('visible');
    if (topBadgeLeft) topBadgeLeft.style.display = 'inline-flex';
    if (heroOverlayHud) heroOverlayHud.classList.remove('hidden');
    if (hotspotHint) hotspotHint.style.opacity = '1';

    dockNavTabs.forEach((tab) => tab.classList.remove('active'));
    showToast('Returned to Workstation');
  };

  // Initialize the 3D Portfolio Scene
  const scene = new PortfolioScene(container, {
    onSelectHotspot: (id: string) => {
      switchToSection(id);
    },
    onHoverHotspot: (id: string | null) => {
      if (!hintText || !hotspotHint || currentViewId !== null) return;
      if (id) {
        const labels: Record<string, string> = {
          projects: 'View Projects on Screen (Click Diamond)',
          experience: 'Inspect EPI Badges & Lanyards (Click Diamond)',
          about: 'Talk to Robot (Click Diamond)',
          contact: 'Check Phone for Contact (Click Diamond)',
          audio: 'Play Calm Ambient Lofi (Click Diamond)',
          electromechanics: 'Inspect Electromechanical Blueprints (Click Diamond)',
        };
        hintText.textContent = labels[id] || `Inspect ${id}`;
        hotspotHint.style.borderColor = 'rgba(244, 63, 94, 0.9)';
      } else {
        hintText.textContent = 'Hover or click glowing diamonds to explore workstation';
        hotspotHint.style.borderColor = 'rgba(244, 63, 94, 0.3)';
      }
    },
  });

  // Connect Web Audio beat callback to pulse speaker rings in 3D
  audioManager.onBeat = (intensity) => {
    scene.pulseSpeaker(intensity);
  };

  // Back to room buttons
  backToRoomBtn?.addEventListener('click', returnToRoom);
  camResetBtn?.addEventListener('click', returnToRoom);
  phoneBackRoomIcon?.addEventListener('click', returnToRoom);

  // Bottom dock tabs
  dockNavTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      if (target) {
        switchToSection(target);
      }
    });
  });

  // ESC key returns to room
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentViewId !== null) {
      returnToRoom();
    }
  });

  /* ================= 1. PROJECTS VIEW (OS Desktop Tabs) ================= */
  const winTabBtns = document.querySelectorAll<HTMLButtonElement>('.win-tab-btn');
  const winTabContents = {
    tabOverview: document.getElementById('tabOverview'),
    tabData: document.getElementById('tabData'),
    tabCode: document.getElementById('tabCode'),
  };

  winTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      audioManager.playClick(580);
      const tabId = btn.getAttribute('data-tab') as keyof typeof winTabContents;
      winTabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      Object.values(winTabContents).forEach((c) => {
        if (c) c.style.display = 'none';
      });
      const selected = winTabContents[tabId];
      if (selected) selected.style.display = 'block';
    });
  });

  /* ================= 2. EXPERIENCE VIEW (Badges Carousel & Flip) ================= */
  const badges = document.querySelectorAll<HTMLElement>('.badge-flip-card');
  const badgeCounter = document.getElementById('badgeCounter');
  const badgePrevBtn = document.getElementById('badgePrevBtn');
  const badgeNextBtn = document.getElementById('badgeNextBtn');
  let currentBadgeIndex = 0;

  const updateBadgeCarousel = (newIndex: number): void => {
    currentBadgeIndex = (newIndex + badges.length) % badges.length;
    badges.forEach((b, idx) => {
      if (idx === currentBadgeIndex) {
        b.classList.add('active');
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        b.classList.remove('active');
      }
    });
    if (badgeCounter) {
      badgeCounter.textContent = `0${currentBadgeIndex + 1} / 0${badges.length}`;
    }
    audioManager.playClick(600);
  };

  badgePrevBtn?.addEventListener('click', () => updateBadgeCarousel(currentBadgeIndex - 1));
  badgeNextBtn?.addEventListener('click', () => updateBadgeCarousel(currentBadgeIndex + 1));

  // Flip card on click
  badges.forEach((card, idx) => {
    card.addEventListener('click', () => {
      if (idx !== currentBadgeIndex) {
        updateBadgeCarousel(idx);
      } else {
        card.classList.toggle('flipped');
        audioManager.playClick(720);
      }
    });
  });

  /* ================= 3. ABOUT VIEW (Robot Chat & Bio) ================= */
  const tabBtnChat = document.getElementById('tabBtnChat');
  const tabBtnBio = document.getElementById('tabBtnBio');
  const panelChat = document.getElementById('panelChat');
  const panelBio = document.getElementById('panelBio');
  const robotChatForm = document.getElementById('robotChatForm') as HTMLFormElement | null;
  const robotInputText = document.getElementById('robotInputText') as HTMLInputElement | null;
  const robotMessagesBox = document.getElementById('robotMessagesBox');
  const quickChips = document.querySelectorAll<HTMLButtonElement>('.quick-chip');

  tabBtnChat?.addEventListener('click', () => {
    tabBtnChat.classList.add('active');
    tabBtnBio?.classList.remove('active');
    if (panelChat) panelChat.style.display = 'flex';
    if (panelBio) panelBio.style.display = 'none';
  });

  tabBtnBio?.addEventListener('click', () => {
    tabBtnBio.classList.add('active');
    tabBtnChat?.classList.remove('active');
    if (panelChat) panelChat.style.display = 'none';
    if (panelBio) panelBio.style.display = 'flex';
  });

  const getBotReply = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('study') || q.includes('epi') || q.includes('university') || q.includes('school')) {
      return "Yassine is currently studying Software Engineering at EPI (École Pluridisciplinaire Internationale) in Tunisia, focusing on algorithms, software architecture, and modern web systems.";
    }
    if (q.includes('project') || q.includes('work') || q.includes('built')) {
      return "He has built several standout projects including the 'Campus Study Hub' (centralized student resource portal), 'TaskFlow Manager' (productivity app), and 'WeatherPulse Dashboard'. You can check them in the Projects tab!";
    }
    if (q.includes('skill') || q.includes('tech') || q.includes('stack')) {
      return "Yassine's core tech stack includes HTML5, CSS3, TypeScript, JavaScript (ES6+), Three.js for 3D web experiences, Python, SQL, Git & GitHub, and REST APIs.";
    }
    if (q.includes('contact') || q.includes('email') || q.includes('hire') || q.includes('phone')) {
      return "You can reach Yassine directly via email at yassineayadi273@gmail.com, or visit his GitHub at github.com/yassineayadi273. Click on his phone on the desk for instant links!";
    }
    return "Yassine is passionate about clean code, smooth 3D web experiences, and building modern web apps. Feel free to explore his projects on the monitor or reach him on his phone!";
  };

  const appendChatMessage = (msg: string, isUser: boolean): void => {
    if (!robotMessagesBox) return;
    const bubble = document.createElement('div');
    bubble.className = isUser ? 'user-msg-bubble' : 'bot-msg-bubble';
    bubble.textContent = msg;
    robotMessagesBox.appendChild(bubble);
    robotMessagesBox.scrollTop = robotMessagesBox.scrollHeight;
  };

  robotChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = robotInputText?.value.trim();
    if (!query) return;

    appendChatMessage(query, true);
    if (robotInputText) robotInputText.value = '';
    audioManager.playClick(640);

    setTimeout(() => {
      const reply = getBotReply(query);
      appendChatMessage(reply, false);
      audioManager.playClick(520);
    }, 400);
  });

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q') || chip.textContent || '';
      appendChatMessage(q, true);
      audioManager.playClick(640);
      setTimeout(() => {
        const reply = getBotReply(q);
        appendChatMessage(reply, false);
        audioManager.playClick(520);
      }, 350);
    });
  });

  /* ================= 4. CONTACT VIEW (Smartphone Lockscreen) ================= */
  const phoneCopyEmailBtn = document.getElementById('phoneCopyEmailBtn');
  const phoneEmailLabel = document.getElementById('phoneEmailLabel');

  phoneCopyEmailBtn?.addEventListener('click', async () => {
    const email = 'yassineayadi273@gmail.com';
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const input = document.createElement('input');
      input.value = email;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    if (phoneEmailLabel) phoneEmailLabel.textContent = '✓ Copied to clipboard!';
    showToast('Email address copied to clipboard!');
    audioManager.playClick(750);
    setTimeout(() => {
      if (phoneEmailLabel) phoneEmailLabel.textContent = email;
    }, 2400);
  });

  /* ================= 5. AUDIO VIEW & CONTROLS ================= */
  const updateAudioUI = (playing: boolean): void => {
    if (soundToggleBtn && soundLabel) {
      if (playing) {
        soundToggleBtn.classList.add('playing');
        soundLabel.textContent = 'Pause Music';
      } else {
        soundToggleBtn.classList.remove('playing');
        soundLabel.textContent = 'Play Calm Music';
      }
    }
    if (spPlayBtn && spPlayIcon && spPlayText) {
      spPlayIcon.textContent = playing ? '⏸' : '▶';
      spPlayText.textContent = playing ? 'Pause' : 'Play';
    }
    if (spTrackTitle) {
      spTrackTitle.textContent = audioManager.getCurrentThemeName();
    }
  };

  audioManager.onPlayStateChange = (playing) => {
    updateAudioUI(playing);
  };

  soundToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isPlaying = audioManager.toggle();
    updateAudioUI(isPlaying);
    showToast(isPlaying ? `♫ Playing: ${audioManager.getCurrentThemeName()}` : '♫ Music Paused');
  });

  spPlayBtn?.addEventListener('click', () => {
    const isPlaying = audioManager.toggle();
    updateAudioUI(isPlaying);
  });

  phonePlayMusicIcon?.addEventListener('click', () => {
    const isPlaying = audioManager.toggle();
    updateAudioUI(isPlaying);
    showToast(isPlaying ? `♫ Ambient Calm: ${audioManager.getCurrentThemeName()}` : '♫ Music Paused');
  });

  musicVolumeSlider?.addEventListener('input', () => {
    const val = parseFloat(musicVolumeSlider.value) / 100;
    audioManager.setVolume(val);
    if (spVolumeSlider) spVolumeSlider.value = musicVolumeSlider.value;
  });

  spVolumeSlider?.addEventListener('input', () => {
    const val = parseFloat(spVolumeSlider.value) / 100;
    audioManager.setVolume(val);
    if (musicVolumeSlider) musicVolumeSlider.value = spVolumeSlider.value;
  });

  // Theme chips in top bar
  themeChips.forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const theme = chip.getAttribute('data-theme') as MusicTheme;
      if (theme) {
        themeChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        spMoodBtns.forEach((b) => {
          if (b.getAttribute('data-theme') === theme) b.classList.add('active');
          else b.classList.remove('active');
        });
        audioManager.setTheme(theme);
        if (!audioManager.getIsPlaying()) audioManager.play();
        updateAudioUI(true);
        showToast(`♫ Switched to ${audioManager.getCurrentThemeName()}`);
      }
    });
  });

  // Speaker card mood buttons
  spMoodBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme') as MusicTheme;
      if (theme) {
        spMoodBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        themeChips.forEach((c) => {
          if (c.getAttribute('data-theme') === theme) c.classList.add('active');
          else c.classList.remove('active');
        });
        audioManager.setTheme(theme);
        if (!audioManager.getIsPlaying()) audioManager.play();
        updateAudioUI(true);
        showToast(`♫ Switched to ${audioManager.getCurrentThemeName()}`);
      }
    });
  });

  /* ================= LIVE CLOCK ================= */
  const updateClocks = (): void => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    const osClock = document.getElementById('osClock');
    if (osClock) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      osClock.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${timeStr}`;
    }

    const phoneClock = document.getElementById('phoneClock');
    if (phoneClock) phoneClock.textContent = timeStr;
  };
  updateClocks();
  setInterval(updateClocks, 10000);

  /* First user interaction starts calm ambience */
  const handleFirstInteraction = () => {
    window.removeEventListener('pointerdown', handleFirstInteraction);
    if (!audioManager.getIsPlaying()) {
      audioManager.play();
      updateAudioUI(true);
      showToast(`♫ Ambient Calm: ${audioManager.getCurrentThemeName()}`);
    }
  };
  window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
});

export {};
