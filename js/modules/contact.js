Modules.Contact = {
  render(container) {
    const lang = currentLang;
    container.innerHTML = '';

    const shell = createEl('section', { className: 'contact-console' });
    shell.appendChild(createEl('header', { className: 'contact-signal-hero' }, [
      createEl('div', {}, [
        createEl('span', { textContent: 'MESSAGE RELAY / 05' }),
        createEl('h2', { textContent: lang === 'en' ? 'Leave a Signal' : '给我留言' }),
        createEl('p', {
          textContent: lang === 'en'
            ? 'This is a real message form, not a decorative terminal.'
            : '留言会直接发到本站服务器，我看到后会尽量回复。',
        }),
      ]),
      createEl('div', { className: 'contact-signal-status' }, [
        createEl('strong', { textContent: 'LINK' }),
        createEl('span', { textContent: 'STANDBY' }),
      ]),
    ]));

    const form = createEl('form', { className: 'contact-form contact-form-grid' });

    // To field (read-only)
    form.appendChild(createEl('div', { className: 'contact-to-field' }, [
      createEl('span', { className: 'contact-to-label', textContent: (lang === 'en' ? 'To' : '收件人') + ':' }),
      createEl('span', { className: 'contact-to-value', textContent: 'MENTAL OUT // MESSAGE RELAY' }),
    ]));

    // Name
    form.appendChild(this.createField('name', 'nameLabel', 'namePlaceholder', 10, lang));

    // Contact
    form.appendChild(this.createField('contact', 'contactLabel', 'contactPlaceholder', 30, lang));

    // Message
    const msgGroup = createEl('div', { className: 'contact-field contact-message-field form-group' });
    msgGroup.appendChild(createEl('label', {
      className: 'form-label',
      textContent: '• ' + t('messageLabel'),
      for: 'msg-input',
    }));
    const msgTextarea = createEl('textarea', {
      className: 'form-textarea',
      id: 'msg-input',
      name: 'message',
      placeholder: t('messagePlaceholder'),
      maxlength: '1000',
    });
    const msgCounter = createEl('span', {
      className: 'char-counter',
      textContent: '0/1000',
      id: 'msg-counter',
    });
    msgTextarea.addEventListener('input', () => {
      msgCounter.textContent = msgTextarea.value.length + '/1000';
    });
    msgGroup.appendChild(msgTextarea);
    msgGroup.appendChild(msgCounter);
    form.appendChild(msgGroup);

    // Submit
    const submitBtn = createEl('button', {
      className: 'contact-submit submit-btn',
      type: 'submit',
      textContent: this.buttonLabel(lang),
    });
    form.appendChild(submitBtn);

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.querySelector('#name-input').value.trim();
      const contact = form.querySelector('#contact-input').value.trim();
      const message = form.querySelector('#msg-input').value.trim();

      if (!name || !contact || !message) {
        alert(t('emptyField'));
        return;
      }

      // Show sending animation
      submitBtn.textContent = '...';
      submitBtn.disabled = true;

      try {
        const resp = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contact, message }),
        });

        if (resp.ok) {
          // Success animation: paper plane
          this.showSendAnimation(submitBtn);
          setTimeout(() => {
            alert(t('submitSuccess'));
            form.reset();
            document.getElementById('name-counter').textContent = '0/10';
            document.getElementById('contact-counter').textContent = '0/30';
            document.getElementById('msg-counter').textContent = '0/1000';
            submitBtn.textContent = this.buttonLabel(lang);
            submitBtn.disabled = false;
          }, 600);
        } else {
          const data = await resp.json().catch(() => ({}));
          alert(data.error || t('submitFail'));
          submitBtn.textContent = this.buttonLabel(lang);
          submitBtn.disabled = false;
        }
      } catch {
        // API might not be available
        alert(lang === 'en' ? 'Backend not connected yet~ But thanks for the message in spirit!' : '后端还没接上哦~ 但心意收到了！');
        submitBtn.textContent = this.buttonLabel(lang);
        submitBtn.disabled = false;
      }
    });

    shell.appendChild(form);
    container.appendChild(shell);
  },

  createField(id, labelKey, placeholderKey, maxLen, lang) {
    const group = createEl('div', { className: 'contact-field form-group' });
    group.appendChild(createEl('label', {
      className: 'form-label',
      textContent: '• ' + t(labelKey),
      for: id + '-input',
    }));

    const input = createEl('input', {
      className: 'form-input',
      type: 'text',
      id: id + '-input',
      name: id,
      placeholder: t(placeholderKey),
      maxlength: String(maxLen),
    });

    const counter = createEl('span', {
      className: 'char-counter',
      textContent: '0/' + maxLen,
      id: id + '-counter',
    });

    input.addEventListener('input', () => {
      counter.textContent = input.value.length + '/' + maxLen;
    });

    group.appendChild(input);
    group.appendChild(counter);
    return group;
  },

  buttonLabel(lang) {
    return lang === 'en' ? 'SEND SIGNAL  →' : '发送留言  →';
  },

  showSendAnimation(btn) {
    const rect = btn.getBoundingClientRect();
    const plane = createEl('div', {
      style: {
        position: 'fixed',
        left: rect.left + rect.width / 2 + 'px',
        top: rect.top + 'px',
        fontSize: '24px',
        zIndex: '200',
        pointerEvents: 'none',
        transition: 'all 0.6s ease-in',
      },
      className: 'contact-send-trace',
      textContent: 'SEND / 01',
    });
    document.body.appendChild(plane);

    requestAnimationFrame(() => {
      plane.style.transform = 'translate(100px, -200px) scale(2)';
      plane.style.opacity = '0';
    });

    setTimeout(() => plane.remove(), 700);
  },
};
