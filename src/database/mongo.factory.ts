import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export async function createMongoOptions(
  config: ConfigService,
): Promise<MongooseModuleOptions> {
  const useMemory = config.get<string>('USE_MEMORY_MONGO') === 'true';

  if (useMemory) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const memory = await MongoMemoryServer.create();
    const uri = memory.getUri('proxo-vpn');
    console.log('Using in-memory MongoDB for local development');
    return { uri };
  }

  return {
    uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/proxo-vpn'),
  };
}
