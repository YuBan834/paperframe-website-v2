const TicketQrImport = {
  maxFileBytes: 10 * 1024 * 1024,
  maxDecodeSide: 1800,

  async decodeFile(file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      throw new Error('请选择二维码图片。');
    }
    if (file.size > this.maxFileBytes) throw new Error('图片不能超过 10MB。');
    if (typeof jsQR !== 'function') throw new Error('二维码解析组件尚未加载。');

    const bitmap = await this.loadBitmap(file);
    try {
      const scale = Math.min(1, this.maxDecodeSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const result = jsQR(image.data, width, height, { inversionAttempts: 'attemptBoth' });
      if (!result?.data) throw new Error('没有在图片中识别到二维码。');
      const credential = this.extractCredential(result.data);
      if (!credential) throw new Error('二维码不是 PaperFrame 数字访问票。');
      return credential;
    } finally {
      bitmap.close?.();
    }
  },

  extractCredential(value) {
    const match = String(value || '').toUpperCase().match(/[A-F0-9]{4}(?:-[A-F0-9]{4}){2}/);
    return match?.[0] || '';
  },

  async loadBitmap(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};
