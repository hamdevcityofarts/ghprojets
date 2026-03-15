const axios = require('axios');

class CybersourceService {
  constructor() {
    this.merchantId = process.env.CYBERSOURCE_MERCHANT_ID;
    this.apiKey = process.env.CYBERSOURCE_API_KEY;
    this.apiSecret = process.env.CYBERSOURCE_API_SECRET;
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api.cybersource.com' 
      : 'https://apitest.cybersource.com';
  }

  /**
   * 🔹 TRAITER UN PAIEMENT (Simulation ou Réel)
   */
  async processPayment(paymentData) {
    // Simulation si pas configuré ou en développement
    if (!this.merchantId || process.env.NODE_ENV === 'development') {
      return this.simulatePayment(paymentData);
    }

    try {
      // 🔒 IMPLÉMENTATION RÉELLE CYBERSOURCE
      const requestPayload = this.buildPaymentRequest(paymentData);
      
      const response = await axios.post(
        `${this.baseURL}/pts/v2/payments`,
        requestPayload,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.merchantId}:${this.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.formatCybersourceResponse(response.data);

    } catch (error) {
      console.error('❌ Erreur Cybersource:', error.response?.data || error.message);
      return {
        status: 'DECLINED',
        message: error.response?.data?.errorInformation?.message || 'Erreur de connexion au processeur de paiement',
        declineReason: error.response?.data?.errorInformation?.reason || 'PROCESSOR_ERROR'
      };
    }
  }

  /**
   * 🔹 CONSTRUIRE LA REQUÊTE CYBERSOURCE
   */
  buildPaymentRequest(paymentData) {
    const [expiryMonth, expiryYear] = paymentData.cardData.expiry.split('/');
    
    return {
      clientReferenceInformation: {
        code: `RES-${paymentData.reservationId}`,
        comments: `Paiement ${paymentData.type} - ${paymentData.clientName}`
      },
      processingInformation: {
        commerceIndicator: 'internet',
        paymentSolution: '001' // Visa Ready
      },
      paymentInformation: {
        card: {
          number: paymentData.cardData.number.replace(/\s/g, ''),
          expirationMonth: expiryMonth.trim(),
          expirationYear: `20${expiryYear.trim()}`,
          securityCode: paymentData.cardData.cvv,
          type: this.detectCardType(paymentData.cardData.number)
        }
      },
      orderInformation: {
        amountDetails: {
          totalAmount: paymentData.amount.toFixed(2),
          currency: paymentData.currency
        },
        billTo: {
          firstName: paymentData.clientName.split(' ')[0],
          lastName: paymentData.clientName.split(' ').slice(1).join(' ') || 'Client',
          email: paymentData.clientEmail,
          address1: '123 Main St',
          locality: 'Douala',
          administrativeArea: 'Littoral',
          postalCode: '00237',
          country: 'CM'
        }
      }
    };
  }

  /**
   * 🔹 DÉTECTER LE TYPE DE CARTE
   */
  detectCardType(cardNumber) {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(cleanNumber)) return '001'; // Visa
    if (/^5[1-5]/.test(cleanNumber)) return '002'; // Mastercard
    if (/^3[47]/.test(cleanNumber)) return '003'; // American Express
    if (/^6(?:011|5)/.test(cleanNumber)) return '004'; // Discover
    
    return '001'; // Par défaut Visa
  }

  /**
   * 🔹 SIMULATION PAIEMENT (Développement)
   */
  simulatePayment(paymentData) {
    console.log('🔧 Simulation paiement Cybersource:', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      client: paymentData.clientName,
      type: paymentData.type
    });
    
    // Simulation réaliste avec différents scénarios
    const random = Math.random();
    let result;
    
    if (random < 0.85) {
      // 85% de succès
      result = {
        success: true,
        status: 'AUTHORIZED',
        message: 'Paiement approuvé',
        declineReason: null
      };
    } else if (random < 0.92) {
      // 7% fonds insuffisants
      result = {
        success: false,
        status: 'DECLINED', 
        message: 'Fonds insuffisants',
        declineReason: 'INSUFFICIENT_FUNDS'
      };
    } else if (random < 0.96) {
      // 4% carte expirée
      result = {
        success: false,
        status: 'DECLINED',
        message: 'Carte expirée',
        declineReason: 'EXPIRED_CARD'
      };
    } else {
      // 4% erreur système
      result = {
        success: false,
        status: 'DECLINED',
        message: 'Erreur système',
        declineReason: 'SYSTEM_ERROR'
      };
    }
    
    return {
      ...result,
      transactionId: `CS-${paymentData.type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      amount: paymentData.amount,
      currency: paymentData.currency,
      gateway: 'cybersource-mock',
      cardType: this.detectCardType(paymentData.cardData?.number || '4242')
    };
  }

  /**
   * 🔹 FORMATER LA RÉPONSE CYBERSOURCE
   */
  formatCybersourceResponse(data) {
    const isApproved = data.status === 'AUTHORIZED' || data.status === 'PENDING';
    
    return {
      status: isApproved ? 'AUTHORIZED' : 'DECLINED',
      transactionId: data.id,
      amount: parseFloat(data.orderInformation.amountDetails.totalAmount),
      currency: data.orderInformation.amountDetails.currency,
      message: isApproved ? 'Paiement approuvé' : data.errorInformation?.message,
      declineReason: data.errorInformation?.reason,
      rawResponse: data,
      gateway: 'cybersource'
    };
  }

  /**
   * 🔹 TRAITER UN REMBOURSEMENT
   */
  async processRefund(originalTransactionId, amount, currency) {
    if (!this.merchantId || process.env.NODE_ENV === 'development') {
      return this.simulateRefund(originalTransactionId, amount, currency);
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/pts/v2/credits`,
        {
          clientReferenceInformation: {
            code: `REF-${originalTransactionId}`
          },
          refundAmountDetails: {
            totalAmount: amount.toFixed(2),
            currency: currency
          },
          previousOrderId: originalTransactionId
        },
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.merchantId}:${this.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.formatCybersourceResponse(response.data);

    } catch (error) {
      console.error('❌ Erreur remboursement Cybersource:', error);
      return {
        status: 'DECLINED',
        message: 'Erreur lors du remboursement'
      };
    }
  }

  simulateRefund(originalTransactionId, amount, currency) {
    console.log('🔧 Simulation remboursement:', { originalTransactionId, amount, currency });
    
    return {
      status: 'AUTHORIZED',
      transactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      amount: amount,
      currency: currency,
      message: 'Remboursement simulé avec succès',
      gateway: 'cybersource-mock'
    };
  }
}

module.exports = new CybersourceService();