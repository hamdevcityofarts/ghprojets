// config/receiptGenerator.js
const puppeteer = require('puppeteer');

class ReceiptGenerator {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async generatePDF(htmlContent, options = {}) {
    await this.initialize();
    
    const page = await this.browser.newPage();
    
    // Définir le contenu HTML
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });
    
    // Générer le PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      ...options
    });
    
    await page.close();
    
    return pdfBuffer;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new ReceiptGenerator();