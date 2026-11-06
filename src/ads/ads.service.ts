import { Injectable } from '@nestjs/common';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AdsService {
  policyFor(user?: UserDocument | null) {
    if (user?.plan === 'premium') {
      return {
        enabled: false,
        interstitialEveryMinutes: 0,
        rewardedExtendMinutes: 0,
        maxInterstitialsPerDay: 0,
        banner: false,
        units: {
          interstitial: null,
          rewarded: null,
          banner: null,
        },
      };
    }

    return {
      enabled: true,
      interstitialEveryMinutes: 15,
      rewardedExtendMinutes: 20,
      maxInterstitialsPerDay: 8,
      banner: false,
      units: {
        // Replace with real AdMob unit IDs in production.
        interstitial: 'ca-app-pub-xxxx/interstitial',
        rewarded: 'ca-app-pub-xxxx/rewarded',
        banner: null,
      },
      copy: {
        extendTitle: 'Watch a short ad',
        extendBody: 'Get 20 more minutes on Free.',
      },
    };
  }
}
