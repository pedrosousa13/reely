import type { ProviderAdapter, ResolvedPlayerSource } from '@reely/core';
import type { NativePlaybackOptions } from '@reely/provider-native';

export type ProviderLoaderRequest = {
  readonly source: ResolvedPlayerSource;
  readonly media: HTMLVideoElement | null;
  readonly nativeOptions: NativePlaybackOptions;
};

export const loadProvider = async ({
  media,
  nativeOptions,
  source
}: ProviderLoaderRequest): Promise<ProviderAdapter> => {
  if (source.type === 'hls') {
    if (!media) {
      throw new Error('The HLS provider requires a media mount.');
    }
    const { createHlsProvider } = await import('@reely/provider-hls');
    return createHlsProvider(media, source, nativeOptions);
  }
  if (source.type !== 'video') {
    throw new Error(`No provider adapter is installed for ${source.type}.`);
  }
  if (!media) {
    throw new Error('The native provider requires a media mount.');
  }
  const { createNativeProvider } = await import('@reely/provider-native');
  return createNativeProvider(media, nativeOptions);
};
