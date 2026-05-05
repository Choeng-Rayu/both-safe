import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getCheckoutConfig(productId: string) {
    const product = await this.prisma.digitalProduct.findUnique({
      where: { id: productId },
      include: { seller: true, plans: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      product,
      wording: {
        headline: 'Protected checkout',
        subcopy:
          'Secured digital delivery with payment confirmation and manual release review.',
      },
      rails: ['binance', 'payway_bakong', 'bakong'],
    };
  }

  getButtonScript(productId: string) {
    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    return `
(function () {
  var target = document.currentScript && document.currentScript.dataset.target;
  var mount = target ? document.querySelector(target) : document.currentScript.parentElement;
  if (!mount) return;
  var link = document.createElement('a');
  link.href = '${appUrl}/embed/${productId}';
  link.textContent = 'Buy with BothSafe';
  link.rel = 'noopener noreferrer';
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';
  link.style.justifyContent = 'center';
  link.style.padding = '10px 14px';
  link.style.border = '1px solid #111827';
  link.style.borderRadius = '8px';
  link.style.background = '#111827';
  link.style.color = '#ffffff';
  link.style.font = '600 14px system-ui, sans-serif';
  link.style.textDecoration = 'none';
  mount.appendChild(link);
})();`;
  }
}
