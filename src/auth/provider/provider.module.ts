import { DynamicModule, Module } from '@nestjs/common';

import {
    ProviderOptionsSymbol,
    TypeAsyncOptions,
    TypeOptions,
} from './provider.constants';
import { ProviderService } from './provider.service';

/**
 * Dynamic module for configuring and providing third-party authentication providers
 * (e.g., Google, GitHub, etc.). It allows both synchronous and asynchronous registration
 * of provider services.
 */
@Module({})
export class ProviderModule {
    public static register(options: TypeOptions): DynamicModule {
        return {
            module: ProviderModule,
            providers: [
                {
                    useValue: options.services, // The actual provider instances
                    provide: ProviderOptionsSymbol, // Injection token for the options
                },
                ProviderService,
            ],
            exports: [ProviderService],
        };
    }

    public static registerAsync(options: TypeAsyncOptions): DynamicModule {
        return {
            module: ProviderModule,
            imports: options.imports,
            providers: [
                {
                    useFactory: options.useFactory, // Factory function that returns the option
                    provide: ProviderOptionsSymbol, // Injection token for the options
                    inject: options.inject, // Dependencies to inject into the factory
                },
                ProviderService,
            ],
            exports: [ProviderService],
        };
    }
}
