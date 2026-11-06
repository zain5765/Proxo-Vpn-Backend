import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class FeaturesService {
  constructor(private readonly config: ConfigService) {}

  flagsFor(user?: UserDocument | null) {
    const premium = user?.plan === 'premium';
    const stealthEnabled =
      this.config.get('FEATURE_STEALTH') === 'true' && premium;
    const multiHopEnabled =
      this.config.get('FEATURE_MULTIHOP', 'true') === 'true' && premium;
    const obfuscationResearch =
      this.config.get('FEATURE_OBFUSCATION_RESEARCH', 'true') === 'true';

    return {
      multiHop: multiHopEnabled,
      stealth: stealthEnabled,
      obfuscation: {
        available: stealthEnabled,
        researchMode: obfuscationResearch,
        methods: stealthEnabled
          ? ['udp-obfs-placeholder', 'tls-camouflage-planned']
          : [],
        note: stealthEnabled
          ? 'Stealth endpoints are experimental; use when networks block WireGuard UDP.'
          : 'Stealth requires Premium and FEATURE_STEALTH=true.',
      },
      streamingOptimizedTags: ['streaming'],
      connectTargetMs: 2000,
      failover: true,
      splitTunneling: true,
      killSwitch: true,
    };
  }
}
