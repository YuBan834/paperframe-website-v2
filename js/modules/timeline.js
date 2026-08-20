Modules.Timeline = {
  data: [],
  selectedType: 'anime',
  selectedYear: null,
  selectedId: null,
  paletteCache: new Map(),

  filterMeta: {
    anime: { zh: '番剧', en: 'Anime', code: 'ANI' },
    game: { zh: '游戏', en: 'Game', code: 'GME' },
  },

  typeMeta: {
    anime: { zh: '番剧', en: 'Anime', code: 'ANI' },
    game: { zh: '游戏', en: 'Game', code: 'GME' },
    film: { zh: '电影', en: 'Film', code: 'FLM' },
    series: { zh: '剧集', en: 'Series', code: 'SER' },
    book: { zh: '电影', en: 'Film', code: 'FLM' },
  },

  async render(container) {
    container.innerHTML = '<p class="media-loading">MEDIA ARCHIVE / LOADING…</p>';

    try {
      const response = await fetch('data/media-memory.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      this.data = Array.isArray(payload) ? payload : payload.items;
      this.data = Array.isArray(this.data) ? this.data : [];
      // The archive intentionally keeps two broad shelves: games and the
      // user's watched works. Films, series and the legacy Gatsby row belong
      // to the 番剧 shelf while retaining their own visual type codes.
      this.data = this.data.map(item => ({
        ...item,
        archiveType: item.type === 'game' ? 'game' : 'anime',
      }));

      const latest = Math.max(...this.data.map(item => Number(item.year) || 0));
      if (!this.selectedYear || !this.data.some(item => item.year === this.selectedYear)) {
        this.selectedYear = latest;
      }
      this.renderContent(container);
    } catch (error) {
      console.error('[Timeline] Failed to load media archive:', error);
      container.innerHTML = '<p class="media-loading media-loading-error">游戏与番剧加载失败，请稍后重试。</p>';
    }
  },

  renderContent(container) {
    const lang = currentLang === 'en' ? 'en' : 'zh';
    const typeFiltered = this.data.filter(item => item.archiveType === this.selectedType);
    const allYears = [...new Set(this.data.map(item => item.year))].sort((a, b) => b - a);
    const availableYears = allYears.filter(year => typeFiltered.some(item => item.year === year));

    if (!availableYears.includes(this.selectedYear)) {
      this.selectedYear = availableYears[0] || allYears[0] || null;
    }

    const visibleItems = typeFiltered.filter(item => item.year === this.selectedYear);
    if (!visibleItems.some(item => item.id === this.selectedId)) {
      this.selectedId = visibleItems[0]?.id || null;
    }
    const selectedItem = visibleItems.find(item => item.id === this.selectedId) || visibleItems[0] || null;

    container.innerHTML = '';
    const archive = createEl('section', {
      className: 'media-archive',
      'aria-label': lang === 'en' ? 'Media memory archive' : '游戏与番剧',
      'data-memory-id': selectedItem?.id?.toUpperCase() || 'M00',
      'data-memory-year': String(selectedItem?.year || '----'),
    });

    archive.appendChild(this.createHeader(lang));

    const filterBar = createEl('nav', {
      className: 'media-type-filter',
      'aria-label': lang === 'en' ? 'Media type' : '作品类型',
    });

    for (const [type, meta] of Object.entries(this.filterMeta)) {
      const count = this.data.filter(item => item.archiveType === type).length;
      const button = createEl('button', {
        className: `media-type-button${this.selectedType === type ? ' active' : ''}`,
        type: 'button',
        'data-type': type,
        'aria-pressed': String(this.selectedType === type),
      }, [
        createEl('span', { textContent: meta[lang] }),
        createEl('small', { textContent: String(count).padStart(2, '0') }),
      ]);
      button.addEventListener('click', () => {
        if (this.selectedType === type) return;
        this.selectedType = type;
        this.selectedId = null;
        this.renderContent(container);
        Sound.play('memory');
      });
      filterBar.appendChild(button);
    }
    archive.appendChild(filterBar);

    const workspace = createEl('div', { className: 'media-archive-workspace' });
    workspace.appendChild(this.createYearRail(allYears, typeFiltered, container, lang));
    workspace.appendChild(this.createEntryList(visibleItems, selectedItem, container, lang));
    const detail = this.createDetail(selectedItem, lang);
    workspace.appendChild(detail);
    archive.appendChild(workspace);
    container.appendChild(archive);
    this.applyArtworkTheme(container, archive, detail, selectedItem);
  },

  createHeader(lang) {
    const years = this.data.map(item => item.year);
    const average = this.data.length
      ? this.data.reduce((sum, item) => sum + Number(item.rating || 0), 0) / this.data.length
      : 0;
    const perfect = this.data.filter(item => Number(item.rating) === 5).length;

    const header = createEl('header', { className: 'media-archive-header' });
    const identity = createEl('div', { className: 'media-archive-identity' }, [
      createEl('span', { textContent: 'MEMORY / 03' }),
      createEl('h2', { textContent: lang === 'en' ? 'Media Memory Archive' : '游戏与番剧' }),
      createEl('p', {
        textContent: lang === 'en'
          ? 'Works that left a trace, arranged by the year we met.'
          : '这里记着我看过的番和玩过的游戏，评分和吐槽都很主观。',
      }),
    ]);
    header.appendChild(identity);

    const stats = [
      { value: String(this.data.length).padStart(2, '0'), label: lang === 'en' ? 'MEMORIES' : '个作品' },
      { value: `${Math.min(...years)}—${Math.max(...years)}`, label: lang === 'en' ? 'RANGE' : '时间跨度' },
      { value: average.toFixed(1), label: lang === 'en' ? 'AVG SCORE' : '平均评分' },
      { value: String(perfect).padStart(2, '0'), label: lang === 'en' ? 'FIVE STAR' : '五星作品' },
    ];
    const statGrid = createEl('div', { className: 'media-archive-stats' });
    stats.forEach(stat => {
      statGrid.appendChild(createEl('div', {}, [
        createEl('strong', { textContent: stat.value }),
        createEl('span', { textContent: stat.label }),
      ]));
    });
    header.appendChild(statGrid);
    return header;
  },

  createYearRail(years, typeFiltered, container, lang) {
    const rail = createEl('aside', {
      className: 'media-year-rail',
      'aria-label': lang === 'en' ? 'Year' : '年份',
    });
    rail.appendChild(createEl('span', {
      className: 'media-rail-label',
      textContent: lang === 'en' ? 'YEAR' : '年份',
    }));

    years.forEach(year => {
      const count = typeFiltered.filter(item => item.year === year).length;
      const buttonAttrs = {
        className: `media-year-button${year === this.selectedYear ? ' active' : ''}`,
        type: 'button',
        'aria-pressed': String(year === this.selectedYear),
      };
      if (count === 0) buttonAttrs.disabled = 'disabled';
      const button = createEl('button', buttonAttrs, [
        createEl('strong', { textContent: String(year) }),
        createEl('span', { textContent: String(count).padStart(2, '0') }),
      ]);
      if (count > 0) {
        button.addEventListener('click', () => {
          if (this.selectedYear === year) return;
          this.selectedYear = year;
          this.selectedId = null;
          this.renderContent(container);
          Sound.play('memory');
        });
      }
      rail.appendChild(button);
    });
    return rail;
  },

  createEntryList(items, selectedItem, container, lang) {
    const panel = createEl('section', { className: 'media-entry-panel' });
    const chineseCounts = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const displayCount = chineseCounts[items.length] || String(items.length);
    panel.appendChild(createEl('header', { className: 'media-panel-heading' }, [
      createEl('span', { textContent: String(this.selectedYear || '—') }),
      createEl('p', {
        textContent: lang === 'en'
          ? `${items.length} archived traces`
          : `这一年喜欢过${displayCount}部作品`,
      }),
    ]));

    const list = createEl('div', { className: 'media-entry-list' });
    items.forEach((item, index) => {
      const type = this.typeMeta[item.type] || this.filterMeta.anime;
      const button = createEl('button', {
        className: `media-entry${selectedItem?.id === item.id ? ' active' : ''}`,
        type: 'button',
        'data-type': item.type,
        'aria-pressed': String(selectedItem?.id === item.id),
      });

      const serial = createEl('span', {
        className: 'media-entry-serial',
        textContent: String(index + 1).padStart(2, '0'),
      });
      const cover = item.cover ? createEl('img', {
        className: 'media-entry-cover',
        src: item.cover,
        alt: '',
        loading: 'lazy',
      }) : createEl('span', {
        className: 'media-entry-cover media-entry-cover-fallback',
        textContent: type.code,
      });
      const copy = createEl('span', { className: 'media-entry-copy' }, [
        createEl('small', {
          textContent: `${type.code} / ${item.status === 'active' ? (lang === 'en' ? 'IN PROGRESS' : '进行中') : (lang === 'en' ? 'ARCHIVED' : '已归档')}`,
        }),
        createEl('strong', { textContent: item.title }),
        createEl('span', {
          textContent: item.review || (lang === 'en' ? 'No note was left at the time.' : '当时没有留下文字评价。'),
        }),
      ]);
      const score = createEl('span', { className: 'media-entry-score' }, [
        createEl('strong', { textContent: Number(item.rating).toFixed(1) }),
        createEl('small', { textContent: '/ 5' }),
      ]);

      button.append(serial, cover, copy, score);
      button.addEventListener('click', () => {
        if (this.selectedId === item.id) return;
        this.selectedId = item.id;
        this.renderContent(container);
        Sound.play('memory');
      });
      list.appendChild(button);
    });
    panel.appendChild(list);
    return panel;
  },

  createDetail(item, lang) {
    const detail = createEl('aside', { className: 'media-detail' });
    if (!item) {
      detail.appendChild(createEl('p', {
        className: 'media-detail-empty',
        textContent: lang === 'en' ? 'No memory in this section.' : '这个分区还没有记忆。',
      }));
      return detail;
    }

    const type = this.typeMeta[item.type] || this.filterMeta.anime;
    const poster = createEl('div', {
      className: `media-type-poster${item.cover ? ' has-cover' : ''}${item.wallpaper ? ' has-wallpaper' : ''}`,
      'data-type': item.type,
      'aria-label': `${item.title} / ${type[lang]}`,
    }, [
      createEl('span', { className: 'media-poster-index', textContent: item.id.replace(/\D/g, '').padStart(3, '0') }),
      createEl('span', { className: 'media-poster-type', textContent: type.code }),
      createEl('strong', { textContent: item.title }),
      createEl('small', { textContent: `${item.year} / PERSONAL MEMORY` }),
    ]);
    if (item.cover) {
      const coverUrl = new URL(item.cover, window.location.href).href;
      poster.style.setProperty('--media-cover', `url("${coverUrl}")`);
    }
    if (item.wallpaper) {
      const wallpaperUrl = new URL(item.wallpaper, window.location.href).href;
      poster.style.setProperty('--media-wallpaper', `url("${wallpaperUrl}")`);
    }
    detail.appendChild(poster);

    const score = createEl('div', {
      className: 'media-detail-score',
      style: { '--score': `${Number(item.rating) * 20}%` },
      'aria-label': `${item.rating} / 5`,
    }, [
      createEl('span', { textContent: lang === 'en' ? 'PERSONAL SCORE' : '个人评分' }),
      createEl('strong', { textContent: Number(item.rating).toFixed(1) }),
      createEl('i', {}, [createEl('b')]),
    ]);
    detail.appendChild(score);

    const review = createEl('article', { className: 'media-detail-review' }, [
      createEl('header', {}, [
        createEl('span', { textContent: 'ORIGINAL NOTE' }),
        createEl('small', { textContent: item.status === 'active' ? (lang === 'en' ? 'NOW PLAYING' : '仍在继续') : `${item.year}` }),
      ]),
      createEl('p', {
        textContent: item.review || (lang === 'en'
          ? 'No written note was left. The score itself is the memory.'
          : '当时没有留下文字；这一格只保留评分本身。'),
      }),
    ]);
    detail.appendChild(review);

    if (item.sourceUrl) {
      detail.appendChild(createEl('a', {
        className: 'media-source-link',
        href: item.sourceUrl,
        target: '_blank',
        rel: 'noopener',
        textContent: lang === 'en' ? 'VIEW SUBJECT SOURCE ↗' : '查看作品资料来源 ↗',
      }));
    }

    detail.appendChild(createEl('footer', { className: 'media-detail-footer' }, [
      createEl('span', { textContent: type[lang] }),
      createEl('span', { textContent: item.status === 'active' ? (lang === 'en' ? 'ACTIVE' : '进行中') : (lang === 'en' ? 'ARCHIVED' : '已归档') }),
      createEl('span', { textContent: `ID ${item.id.toUpperCase()}` }),
    ]));
    return detail;
  },

  async applyArtworkTheme(container, archive, detail, item) {
    if (!item) return;
    const source = item.wallpaper || item.cover;
    const fallbacks = {
      anime: [[54, 194, 235], [255, 92, 174]],
      game: [[89, 126, 255], [255, 190, 62]],
    };
    const fallback = fallbacks[item.archiveType] || fallbacks.anime;
    const win = container.closest('.desktop-window');
    const artUrl = source ? new URL(source, window.location.href).href : '';
    if (artUrl) {
      detail.style.setProperty('--media-art', `url("${artUrl}")`);
      win?.style.setProperty('--media-window-art', `url("${artUrl}")`);
    } else {
      win?.style.removeProperty('--media-window-art');
    }

    const apply = (palette, animate = false) => {
      if (!archive.isConnected || this.selectedId !== item.id) return;
      const [primary, secondary] = palette;
      const primarySpace = primary.join(' ');
      const secondarySpace = secondary.join(' ');
      archive.style.setProperty('--media-theme-rgb', primarySpace);
      archive.style.setProperty('--media-secondary-rgb', secondarySpace);
      detail.style.setProperty('--media-theme-rgb', primarySpace);
      detail.style.setProperty('--media-secondary-rgb', secondarySpace);
      if (win) {
        win.classList.add('media-themed-window');
        win.style.setProperty('--app-accent', `rgb(${primary.join(',')})`);
        win.style.setProperty('--app-accent-rgb', primary.join(','));
        win.style.setProperty('--app-secondary-rgb', secondary.join(','));
        if (animate) {
          win.classList.remove('media-theme-enter');
          void win.offsetWidth;
          win.classList.add('media-theme-enter');
        }
      }
    };

    apply(fallback, true);
    if (!artUrl) return;
    try {
      const palette = await this.extractArtworkPalette(artUrl);
      apply(palette);
    } catch (_) {
      // The type palette remains in place if an image cannot be sampled.
    }
  },

  extractArtworkPalette(url) {
    if (this.paletteCache.has(url)) return Promise.resolve(this.paletteCache.get(url));
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 36;
          canvas.height = 36;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 36, 36);
          const pixels = context.getImageData(0, 0, 36, 36).data;
          const samples = [];
          for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const chroma = max - min;
            const lightness = (max + min) / 2;
            if (chroma < 18 || lightness < 32 || lightness > 236) continue;
            samples.push({ r, g, b, weight: chroma * (0.55 + lightness / 510) });
          }
          if (!samples.length) throw new Error('Artwork has no usable palette samples');
          samples.sort((a, b) => b.weight - a.weight);
          const chosen = samples.slice(0, Math.max(18, Math.floor(samples.length * 0.38)));
          const total = chosen.reduce((sum, color) => sum + color.weight, 0) || 1;
          const average = [
            Math.round(chosen.reduce((sum, color) => sum + color.r * color.weight, 0) / total),
            Math.round(chosen.reduce((sum, color) => sum + color.g * color.weight, 0) / total),
            Math.round(chosen.reduce((sum, color) => sum + color.b * color.weight, 0) / total),
          ];
          const hsl = this.rgbToHsl(...average);
          hsl[1] = Math.max(0.62, hsl[1]);
          hsl[2] = Math.min(0.62, Math.max(0.46, hsl[2]));
          const primary = this.hslToRgb(...hsl);
          const secondary = this.hslToRgb((hsl[0] + 0.14) % 1, Math.max(0.68, hsl[1]), Math.min(0.66, hsl[2] + 0.08));
          const palette = [primary, secondary];
          this.paletteCache.set(url, palette);
          resolve(palette);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = reject;
      image.src = url;
    });
  },

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h /= 6;
      if (h < 0) h += 1;
    }
    const l = (max + min) / 2;
    const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
    return [h, s, l];
  },

  hslToRgb(h, s, l) {
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (!s) return [l, l, l].map(value => Math.round(value * 255));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
      .map(value => Math.round(value * 255));
  },
};
