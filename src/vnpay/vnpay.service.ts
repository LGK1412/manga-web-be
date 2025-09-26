import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as qs from 'qs';

export interface CreatePaymentBody {
    amount: number;
    ipAddr: string;
    extra?: {
        packageId: number;
        points: number;
        isDouble: boolean;
        txnRef?: string
    };
}

@Injectable()
export class VnpayService {
    constructor() { }

    private getConfig() {
        const tmnCode = process.env.VNP_TMNCODE;
        const hashSecret = process.env.VNP_HASHSECRET;
        const url = process.env.VNP_URL;
        const returnUrl = process.env.VNP_RETURNURL;

        if (!tmnCode || !hashSecret || !url || !returnUrl) {
            throw new BadRequestException('VNPAY config not found! Check your .env');
        }

        return { tmnCode, hashSecret, url, returnUrl };
    }

    async createPaymentUrl(
        body: CreatePaymentBody,
        userId: string,
    ): Promise<{ paymentUrl: string; txnRef: string }> {
        const { tmnCode, hashSecret, url, returnUrl } = this.getConfig();

        const { amount, ipAddr, extra } = body;

        const date = new Date();
        const createDate = date.toISOString().replace(/\D/g, '').slice(0, 14);

        // 🔑 txnRef tối đa 32 ký tự => dùng hash ngắn + timestamp
        const shortUserHash = crypto
            .createHash('md5')
            .update(userId)
            .digest('hex')
            .slice(0, 8); // chỉ lấy 8 ký tự
        const txnRef = `${shortUserHash}${Date.now()}`.slice(0, 32); // đảm bảo không vượt 32 ký tự

        const orderInfo = `user:${userId}|pkg:${extra?.packageId}|points:${extra?.points}|double:${extra?.isDouble}`;

        const vnp_Params: Record<string, string> = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: tmnCode,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: txnRef,
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: 'other',
            vnp_Amount: (amount * 100).toString(),
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate,
        };

        const sortedParams = Object.entries(vnp_Params).sort(([a], [b]) =>
            a.localeCompare(b),
        );
        const signData = sortedParams
            .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
            .join('&');

        const secureHash = crypto
            .createHmac('sha512', hashSecret)
            .update(signData, 'utf-8')
            .digest('hex');

        const paymentUrl = `${url}?${qs.stringify(
            { ...Object.fromEntries(sortedParams), vnp_SecureHash: secureHash },
            { encode: true },
        )}`;

        return { paymentUrl, txnRef };
    }

    verifyReturn(query: Record<string, string>) {
        const { hashSecret } = this.getConfig();

        console.log('[VNPAY VERIFY] raw query:', query);

        const secureHash = query['vnp_SecureHash'];
        const vnpParams = { ...query };
        delete vnpParams['vnp_SecureHash'];
        delete vnpParams['vnp_SecureHashType'];

        const sortedParams = Object.entries(vnpParams).sort(([a], [b]) => a.localeCompare(b));
        const signData = sortedParams
            .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`)
            .join('&');

        console.log('[VNPAY VERIFY] signData:', signData);

        const checkHash = crypto
            .createHmac('sha512', hashSecret)
            .update(signData, 'utf-8')
            .digest('hex');

        console.log('[VNPAY VERIFY] checkHash:', checkHash);
        console.log('[VNPAY VERIFY] secureHash:', secureHash);

        let userId: string | undefined;
        let txnRef: string | undefined;
        if (vnpParams['vnp_TxnRef']) {
            txnRef = vnpParams['vnp_TxnRef'];
            userId = txnRef.split('-')[0];
        }

        return { isValid: secureHash === checkHash, userId, txnRef };
    }
}
