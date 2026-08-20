Modules.Changelog = {
  async render(container) {
    container.innerHTML = '<p class="site-about-loading">READING SITE MANIFEST...</p>';
    try {
      const response = await fetch('data/changelog.json');
      const data = await response.json();
      this.renderContent(container, data);
    } catch (error) {
      container.innerHTML = '<p class="site-about-loading">关于本站加载失败</p>';
    }
  },

  text(item, key) {
    if (currentLang === 'en') return item[`${key}En`] || item[key] || '';
    return item[key] || '';
  },

  externalLink(label, url, className = '') {
    const link = createEl('a', {
      className: `site-about-link ${className}`.trim(),
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: label,
    });
    return link;
  },

  renderContent(container, data) {
    container.innerHTML = '';
    const page = createEl('article', { className: 'site-about-page' });

    const hero = createEl('header', { className: 'site-about-hero' });
    hero.append(
      createEl('div', { className: 'site-about-version' }, [
        createEl('small', { textContent: 'PAPERFRAME / PERSONAL SITE' }),
        createEl('strong', { textContent: `V${data.version}` }),
        createEl('span', { textContent: data.status }),
      ]),
      createEl('div', { className: 'site-about-intro' }, [
        createEl('span', { textContent: '04 / SITE MANIFEST' }),
        createEl('h1', { textContent: this.text(data, 'headline') }),
        createEl('p', { textContent: this.text(data, 'intro') }),
      ]),
    );
    page.appendChild(hero);

    const facts = createEl('section', { className: 'site-about-facts' });
    data.facts.forEach(fact => facts.appendChild(createEl('div', {}, [
      createEl('small', { textContent: this.text(fact, 'label') }),
      createEl('strong', { textContent: fact.value }),
    ])));
    page.appendChild(facts);

    const evolution = createEl('section', { className: 'site-about-section site-about-evolution' });
    evolution.appendChild(createEl('div', { className: 'site-about-section-title' }, [
      createEl('span', { textContent: '01' }),
      createEl('div', {}, [
        createEl('small', { textContent: 'VERSION EVOLUTION' }),
        createEl('h2', { textContent: currentLang === 'en' ? 'Two versions, two ways of building.' : '两个版本，两种开发方式。' }),
      ]),
    ]));
    const eraGrid = createEl('div', { className: 'site-era-grid' });
    data.eras.forEach((era, index) => {
      const card = createEl('div', {
        className: `site-era-card site-era-card--${index + 1}`,
        style: { '--era-accent': era.accent },
        'data-version': era.version,
      });
      card.append(
        createEl('div', { className: 'site-era-meta' }, [
          createEl('strong', { textContent: era.version }),
          createEl('span', { textContent: `${era.year} / ${era.mode}` }),
        ]),
        createEl('h3', { textContent: this.text(era, 'title') }),
        createEl('p', { textContent: this.text(era, 'description') }),
        this.externalLink(this.text(era, 'linkLabel'), era.link),
      );
      eraGrid.appendChild(card);
    });
    evolution.appendChild(eraGrid);
    page.appendChild(evolution);

    const motion = createEl('section', { className: 'site-about-section site-motion-pipeline' });
    motion.append(
      createEl('div', { className: 'site-about-section-title' }, [
        createEl('span', { textContent: '02' }),
        createEl('div', {}, [
          createEl('small', { textContent: 'MOTION WORKFLOW' }),
          createEl('h2', { textContent: this.text(data.motion, 'title') }),
        ]),
      ]),
      createEl('p', { className: 'site-motion-description', textContent: this.text(data.motion, 'description') }),
    );
    const steps = createEl('div', { className: 'site-motion-steps' });
    data.motion.steps.forEach(step => steps.appendChild(createEl('div', {}, [
      createEl('span', { textContent: step.index }),
      createEl('strong', { textContent: this.text(step, 'name') }),
    ])));
    motion.append(steps, this.externalLink('OPEN VRMA LAB ↗', data.motion.link, 'site-about-link--motion'));
    page.appendChild(motion);

    const credits = createEl('section', { className: 'site-about-section site-credit-section' });
    credits.appendChild(createEl('div', { className: 'site-about-section-title' }, [
      createEl('span', { textContent: '03' }),
      createEl('div', {}, [
        createEl('small', { textContent: 'CREDITS / LICENSE' }),
        createEl('h2', { textContent: currentLang === 'en' ? 'Credits are part of the work.' : '署名也是作品的一部分。' }),
      ]),
    ]));
    const creditGrid = createEl('div', { className: 'site-credit-grid' });
    data.credits.forEach((credit, index) => creditGrid.appendChild(createEl('div', {
      className: `site-credit-card${index === 0 ? ' site-credit-card--model' : ''}`,
    }, [
      createEl('small', { textContent: credit.role }),
      createEl('h3', { textContent: credit.name }),
      createEl('strong', { textContent: this.text(credit, 'author') }),
      createEl('p', { textContent: this.text(credit, 'note') }),
      createEl('span', { textContent: credit.state }),
    ])));
    credits.appendChild(creditGrid);
    page.appendChild(credits);

    page.appendChild(createEl('footer', { className: 'site-about-footer' }, [
      createEl('span', { textContent: 'DESIGNED & DIRECTED BY PAPERFRAME' }),
      createEl('strong', { textContent: 'V2.0 / 2026' }),
    ]));
    container.appendChild(page);
  },
};
