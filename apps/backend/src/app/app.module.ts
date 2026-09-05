import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { AccessEvent } from './qr-validation/entities/access-event.entity';
import { QrValidationModule } from './qr-validation/qr-validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite' as const,
        database: configService.get<string>('DATABASE_PATH', 'petsystem.sqlite'),
        entities: [User, AccessEvent],
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    QrValidationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
