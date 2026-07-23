import {
  PlayerController,
  detectSource,
  type AutoplayMode,
  type PlayerSource,
  type PlayerState
} from '@reely/core';
import type { NativePlaybackOptions } from '@reely/provider-native';
import { useActivation, type ActivationBindings } from './use-activation.js';
import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ImgHTMLAttributes,
  type ReactNode,
  type ReactElement,
  type Ref
} from 'react';

type PlayerContextValue = ActivationBindings & {
  controller: PlayerController;
  source: ReturnType<typeof detectSource>;
};

type SourceTransition = {
  readonly key: string;
};

export type ViewportProps = ComponentPropsWithRef<'div'>;

export type PosterProps = ComponentPropsWithoutRef<'div'>;

export type ResponsivePoster = {
  readonly src: string;
  readonly srcSet?: string;
  readonly sizes?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
  readonly fetchPriority?: ImgHTMLAttributes<HTMLImageElement>['fetchPriority'];
  readonly decoding?: ImgHTMLAttributes<HTMLImageElement>['decoding'];
  readonly objectFit?: CSSProperties['objectFit'];
  readonly objectPosition?: CSSProperties['objectPosition'];
};

export type PosterInput = string | ResponsivePoster | ReactElement;

export type NormalizedPoster =
  | { readonly type: 'image'; readonly props: ResponsivePoster }
  | { readonly type: 'custom'; readonly element: ReactElement };

export type PosterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  keyof ResponsivePoster
> &
  Partial<ResponsivePoster>;

export type MediaProps = {
  readonly nativePoster?: string;
};

export const normalizePoster = (input: PosterInput): NormalizedPoster => {
  if (typeof input === 'string') {
    return { type: 'image', props: { src: input } };
  }
  if (isValidElement(input)) {
    return { type: 'custom', element: input };
  }
  return { type: 'image', props: { ...input } };
};

export type PlayerHandle = Pick<
  PlayerController,
  | 'getState'
  | 'subscribe'
  | 'on'
  | 'play'
  | 'pause'
  | 'togglePlayback'
  | 'seekTo'
  | 'seekBy'
  | 'mute'
  | 'unmute'
  | 'toggleMuted'
  | 'setVolume'
  | 'setPlaybackRate'
  | 'selectTextTrack'
  | 'requestFullscreen'
  | 'exitFullscreen'
  | 'requestPictureInPicture'
  | 'exitPictureInPicture'
  | 'retry'
>;

export type PlayerActions = Omit<PlayerHandle, 'getState' | 'subscribe' | 'on'>;

export type { PlayerLoadingStrategy, PlayerPreload } from './use-activation.js';

export type PlayerActivationProps = {
  readonly loading?: import('./use-activation.js').PlayerLoadingStrategy;
  readonly loadMargin?: string;
  readonly preload?: import('./use-activation.js').PlayerPreload;
};

export type RootProps = NativePlaybackOptions &
  PlayerActivationProps & {
    readonly autoplay?: AutoplayMode;
    readonly children: ReactNode;
    readonly defaultMuted?: boolean;
    readonly defaultPlaybackRate?: number;
    readonly defaultVolume?: number;
    readonly muted?: boolean;
    readonly onMutedChange?: (muted: boolean) => void;
    readonly onPlaybackRateChange?: (playbackRate: number) => void;
    readonly onVolumeChange?: (volume: number) => void;
    readonly playbackRate?: number;
    readonly ref?: Ref<PlayerHandle>;
    readonly source: PlayerSource;
    readonly volume?: number;
  };

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PosterContext = createContext<'visible' | 'hidden'>('visible');

const usePlayer = (): PlayerContextValue => {
  const player = useContext(PlayerContext);
  if (!player)
    throw new Error(
      'Player hooks and primitives must be used inside Player.Root.'
    );
  return player;
};

const usePosterState = (): 'visible' | 'hidden' => useContext(PosterContext);

const selectionsEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== 'object' ||
    left === null ||
    typeof right !== 'object' ||
    right === null
  ) {
    return false;
  }
  const leftPrototype = Object.getPrototypeOf(left);
  if (
    leftPrototype !== Object.getPrototypeOf(right) ||
    (leftPrototype !== Object.prototype && !Array.isArray(left))
  ) {
    return false;
  }
  const enumerableOwnKeys = (value: object): PropertyKey[] =>
    Reflect.ownKeys(value).filter((key) =>
      Object.prototype.propertyIsEnumerable.call(value, key)
    );
  const leftKeys = enumerableOwnKeys(left);
  const rightKeys = enumerableOwnKeys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        Object.is(
          (left as Record<PropertyKey, unknown>)[key],
          (right as Record<PropertyKey, unknown>)[key]
        )
    )
  );
};

type Reconciliation<Value> = { value: Value };

const takeSuperseded = <Value,>(
  reconciliations: Reconciliation<Value>[],
  confirmed: Value
): boolean => {
  let matched = false;
  for (let index = reconciliations.length - 1; index >= 0; index -= 1) {
    if (!Object.is(reconciliations[index]?.value, confirmed)) continue;
    reconciliations.splice(index, 1);
    matched = true;
  }
  return matched;
};

export const usePlayerState = <Selected,>(
  selector: (state: PlayerState) => Selected
): Selected => {
  const { controller } = usePlayer();
  const selectionRef = useRef<{
    initialized: boolean;
    selector?: (state: PlayerState) => Selected;
    state?: PlayerState;
    value?: Selected;
  }>({ initialized: false });
  const getSnapshot = useCallback((): Selected => {
    const state = controller.getState();
    if (
      selectionRef.current.initialized &&
      selectionRef.current.state === state &&
      selectionRef.current.selector === selector
    ) {
      return selectionRef.current.value as Selected;
    }
    const nextSelection = selector(state);
    if (
      selectionRef.current.initialized &&
      selectionsEqual(selectionRef.current.value, nextSelection)
    ) {
      selectionRef.current.selector = selector;
      selectionRef.current.state = state;
      return selectionRef.current.value as Selected;
    }
    selectionRef.current = {
      initialized: true,
      selector,
      state,
      value: nextSelection
    };
    return nextSelection;
  }, [controller, selector]);
  return useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
};

export const usePlayerActions = (): PlayerActions => {
  const { controller } = usePlayer();
  return useMemo(
    () => ({
      play: controller.play,
      pause: controller.pause,
      togglePlayback: controller.togglePlayback,
      seekTo: controller.seekTo,
      seekBy: controller.seekBy,
      mute: controller.mute,
      unmute: controller.unmute,
      toggleMuted: controller.toggleMuted,
      setVolume: controller.setVolume,
      setPlaybackRate: controller.setPlaybackRate,
      selectTextTrack: controller.selectTextTrack,
      requestFullscreen: controller.requestFullscreen,
      exitFullscreen: controller.exitFullscreen,
      requestPictureInPicture: controller.requestPictureInPicture,
      exitPictureInPicture: controller.exitPictureInPicture,
      retry: controller.retry
    }),
    [controller]
  );
};

export const Root = ({
  autoplay = false,
  children,
  defaultMuted = false,
  defaultPlaybackRate = 1,
  defaultVolume = 1,
  endTime,
  loadMargin = '200px 0px',
  loading = 'viewport',
  loop,
  muted,
  onMutedChange,
  onPlaybackRateChange,
  onVolumeChange,
  playbackRate,
  ref,
  source,
  startTime,
  preload = 'metadata',
  volume
}: RootProps) => {
  const [controller] = useState(() => new PlayerController());
  const [hiddenTransition, setHiddenTransition] = useState<SourceTransition>();
  const currentMedia = useRef<HTMLVideoElement | null>(null);
  const providerSourceTransition = useRef<SourceTransition | undefined>(
    undefined
  );
  const loadedDataListener = useRef<
    { media: HTMLVideoElement; listener: () => void } | undefined
  >(undefined);
  const desiredMuted = useRef(muted ?? defaultMuted);
  const desiredVolume = useRef(volume ?? defaultVolume);
  const desiredPlaybackRate = useRef(playbackRate ?? defaultPlaybackRate);
  const lastConfirmedMuted = useRef(muted ?? defaultMuted);
  const lastConfirmedVolume = useRef(volume ?? defaultVolume);
  const lastConfirmedPlaybackRate = useRef(playbackRate ?? defaultPlaybackRate);
  const controlledMuted = useRef(muted);
  const controlledVolume = useRef(volume);
  const controlledPlaybackRate = useRef(playbackRate);
  const wasMutedControlled = useRef(muted !== undefined);
  const wasVolumeControlled = useRef(volume !== undefined);
  const wasPlaybackRateControlled = useRef(playbackRate !== undefined);
  const mutedChangeCallback = useRef(onMutedChange);
  const volumeChangeCallback = useRef(onVolumeChange);
  const playbackRateChangeCallback = useRef(onPlaybackRateChange);
  const autoplayConfiguration = useRef({ autoplay, muted });
  const pendingMuted = useRef<Reconciliation<boolean> | undefined>(undefined);
  const pendingVolume = useRef<Reconciliation<number> | undefined>(undefined);
  const pendingPlaybackRate = useRef<Reconciliation<number> | undefined>(
    undefined
  );
  const supersededMuted = useRef<Reconciliation<boolean>[]>([]);
  const supersededVolume = useRef<Reconciliation<number>[]>([]);
  const supersededPlaybackRate = useRef<Reconciliation<number>[]>([]);
  const preferenceUnsubscribe = useRef<(() => void) | undefined>(undefined);
  const detectedSource = useMemo(() => detectSource(source), [source]);
  const sourceKeyForRender = sourceKey(detectedSource);
  const [sourceTransition, setSourceTransition] = useState<SourceTransition>(
    () => ({ key: sourceKeyForRender })
  );
  if (sourceTransition.key !== sourceKeyForRender) {
    setSourceTransition({ key: sourceKeyForRender });
  }

  /* eslint-disable react-hooks/refs -- Provider callbacks need the current props before passive effects run. */
  controlledMuted.current = muted;
  controlledVolume.current = volume;
  controlledPlaybackRate.current = playbackRate;
  mutedChangeCallback.current = onMutedChange;
  volumeChangeCallback.current = onVolumeChange;
  playbackRateChangeCallback.current = onPlaybackRateChange;
  autoplayConfiguration.current = { autoplay, muted };
  /* eslint-enable react-hooks/refs */

  useImperativeHandle(ref, () => controller, [controller]);

  const reconcileMuted = useCallback(
    (value: boolean) => {
      if (pendingMuted.current?.value === value) return;
      const pending = { value };
      pendingMuted.current = pending;
      void (value ? controller.mute() : controller.unmute()).then((result) => {
        if (!result.ok && pendingMuted.current === pending) {
          pendingMuted.current = undefined;
        } else if (!result.ok) {
          const index = supersededMuted.current.indexOf(pending);
          if (index !== -1) supersededMuted.current.splice(index, 1);
        }
      });
    },
    [controller]
  );

  const reconcileVolume = useCallback(
    (value: number) => {
      if (Object.is(pendingVolume.current?.value, value)) return;
      const pending = { value };
      pendingVolume.current = pending;
      void controller.setVolume(value).then((result) => {
        if (!result.ok && pendingVolume.current === pending) {
          pendingVolume.current = undefined;
        } else if (!result.ok) {
          const index = supersededVolume.current.indexOf(pending);
          if (index !== -1) supersededVolume.current.splice(index, 1);
        }
      });
    },
    [controller]
  );

  const reconcilePlaybackRate = useCallback(
    (value: number) => {
      if (Object.is(pendingPlaybackRate.current?.value, value)) return;
      const pending = { value };
      pendingPlaybackRate.current = pending;
      void controller.setPlaybackRate(value).then((result) => {
        if (!result.ok && pendingPlaybackRate.current === pending) {
          pendingPlaybackRate.current = undefined;
        } else if (!result.ok) {
          const index = supersededPlaybackRate.current.indexOf(pending);
          if (index !== -1) supersededPlaybackRate.current.splice(index, 1);
        }
      });
    },
    [controller]
  );

  const ensurePreferenceSubscription = useCallback(() => {
    if (preferenceUnsubscribe.current) return;
    const unsubscribeVolume = controller.on('volumechange', (event) => {
      const confirmedMuted = event.detail.muted;
      const confirmedVolume = event.detail.volume;
      const mutedRestoration = pendingMuted.current;
      const volumeRestoration = pendingVolume.current;
      const mutedRestorationMatches =
        mutedRestoration?.value === confirmedMuted;
      const mutedRetiredMatches = takeSuperseded(
        supersededMuted.current,
        confirmedMuted
      );
      const volumeRestorationMatches = Object.is(
        volumeRestoration?.value,
        confirmedVolume
      );
      const volumeRetiredMatches = takeSuperseded(
        supersededVolume.current,
        confirmedVolume
      );
      const mutedPropDriven = mutedRestorationMatches || mutedRetiredMatches;
      const volumePropDriven = volumeRestorationMatches || volumeRetiredMatches;

      pendingMuted.current = undefined;
      pendingVolume.current = undefined;
      if (controlledMuted.current === confirmedMuted) {
        supersededMuted.current.length = 0;
      }
      if (Object.is(controlledVolume.current, confirmedVolume)) {
        supersededVolume.current.length = 0;
      }
      if (lastConfirmedMuted.current !== confirmedMuted) {
        lastConfirmedMuted.current = confirmedMuted;
        if (!mutedPropDriven) {
          mutedChangeCallback.current?.(confirmedMuted);
        }
      }
      if (controlledMuted.current === undefined) {
        desiredMuted.current = confirmedMuted;
      } else if (controlledMuted.current !== confirmedMuted) {
        reconcileMuted(controlledMuted.current);
      }
      if (!Object.is(lastConfirmedVolume.current, confirmedVolume)) {
        lastConfirmedVolume.current = confirmedVolume;
        if (!volumePropDriven) {
          volumeChangeCallback.current?.(confirmedVolume);
        }
      }
      if (controlledVolume.current === undefined) {
        desiredVolume.current = confirmedVolume;
      } else if (!Object.is(controlledVolume.current, confirmedVolume)) {
        reconcileVolume(controlledVolume.current);
      }
    });
    const unsubscribeRate = controller.on('ratechange', (event) => {
      const confirmed = event.detail.playbackRate;
      const restoration = pendingPlaybackRate.current;
      const restorationMatches = Object.is(restoration?.value, confirmed);
      const retiredMatches = takeSuperseded(
        supersededPlaybackRate.current,
        confirmed
      );
      const propDriven = restorationMatches || retiredMatches;

      pendingPlaybackRate.current = undefined;
      if (Object.is(controlledPlaybackRate.current, confirmed)) {
        supersededPlaybackRate.current.length = 0;
      }
      if (!Object.is(lastConfirmedPlaybackRate.current, confirmed)) {
        lastConfirmedPlaybackRate.current = confirmed;
        if (!propDriven) playbackRateChangeCallback.current?.(confirmed);
      }
      if (controlledPlaybackRate.current === undefined) {
        desiredPlaybackRate.current = confirmed;
      } else if (!Object.is(controlledPlaybackRate.current, confirmed)) {
        reconcilePlaybackRate(controlledPlaybackRate.current);
      }
    });
    preferenceUnsubscribe.current = () => {
      unsubscribeVolume();
      unsubscribeRate();
    };
  }, [controller, reconcileMuted, reconcilePlaybackRate, reconcileVolume]);

  const detachPreparedMedia = useCallback(() => {
    const listener = loadedDataListener.current;
    if (listener) {
      listener.media.removeEventListener('loadeddata', listener.listener);
      loadedDataListener.current = undefined;
    }
    currentMedia.current = null;
    providerSourceTransition.current = undefined;
  }, []);

  const prepareMedia = useCallback(
    (media: HTMLVideoElement) => {
      detachPreparedMedia();
      currentMedia.current = media;
      providerSourceTransition.current = sourceTransition;
      pendingMuted.current = undefined;
      pendingVolume.current = undefined;
      pendingPlaybackRate.current = undefined;
      supersededMuted.current.length = 0;
      supersededVolume.current.length = 0;
      supersededPlaybackRate.current.length = 0;
      media.muted = controlledMuted.current ?? desiredMuted.current;
      const nextVolume = controlledVolume.current ?? desiredVolume.current;
      const nextPlaybackRate =
        controlledPlaybackRate.current ?? desiredPlaybackRate.current;
      if (Number.isFinite(nextVolume)) {
        try {
          media.volume = Math.min(1, Math.max(0, nextVolume));
        } catch {
          // Initial preference seeding must not escape the provider boundary.
        }
      }
      if (Number.isFinite(nextPlaybackRate) && nextPlaybackRate > 0) {
        try {
          media.playbackRate = nextPlaybackRate;
        } catch {
          // Initial preference seeding must not escape the provider boundary.
        }
      }
      ensurePreferenceSubscription();
      controller.configureAutoplay(autoplayConfiguration.current.autoplay, {
        controlledMuted: autoplayConfiguration.current.muted
      });
      const attachedSourceTransition = sourceTransition;
      const onLoadedData = () => {
        if (
          currentMedia.current === media &&
          providerSourceTransition.current === attachedSourceTransition
        ) {
          setHiddenTransition(attachedSourceTransition);
        }
      };
      media.addEventListener('loadeddata', onLoadedData);
      loadedDataListener.current = { media, listener: onLoadedData };
      if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        onLoadedData();
      }
    },
    [
      controller,
      detachPreparedMedia,
      ensurePreferenceSubscription,
      sourceTransition
    ]
  );

  const activation = useActivation({
    autoplay,
    controller,
    loadMargin,
    loading,
    nativeOptions: { endTime, loop, startTime },
    prepareMedia,
    preload,
    source: detectedSource
  });
  const registerActivationMedia = activation.registerMedia;
  const registerMedia = useCallback(
    (media: HTMLVideoElement | null) => {
      if (!media) detachPreparedMedia();
      registerActivationMedia(media);
    },
    [detachPreparedMedia, registerActivationMedia]
  );

  useEffect(() => {
    const unsubscribePoster = controller.subscribe((state) => {
      if (state.playback === 'playing' && providerSourceTransition.current) {
        setHiddenTransition(providerSourceTransition.current);
      }
    });
    return () => {
      unsubscribePoster();
      preferenceUnsubscribe.current?.();
      preferenceUnsubscribe.current = undefined;
      detachPreparedMedia();
    };
  }, [controller, detachPreparedMedia]);

  useEffect(() => {
    controller.configureAutoplay(autoplay, { controlledMuted: muted });
  }, [autoplay, controller, muted]);

  useEffect(() => {
    if (muted === undefined) {
      pendingMuted.current = undefined;
      supersededMuted.current.length = 0;
      if (wasMutedControlled.current) {
        desiredMuted.current = controller.getState().muted;
      }
      wasMutedControlled.current = false;
      return;
    }
    wasMutedControlled.current = true;
    if (pendingMuted.current && pendingMuted.current.value !== muted) {
      supersededMuted.current.push(pendingMuted.current);
      pendingMuted.current = undefined;
    }
    if (controller.getState().muted !== muted) {
      reconcileMuted(muted);
    }
  }, [controller, muted, reconcileMuted]);

  useEffect(() => {
    if (volume === undefined) {
      pendingVolume.current = undefined;
      supersededVolume.current.length = 0;
      if (wasVolumeControlled.current) {
        desiredVolume.current = controller.getState().volume;
      }
      wasVolumeControlled.current = false;
      return;
    }
    wasVolumeControlled.current = true;
    if (
      pendingVolume.current &&
      !Object.is(pendingVolume.current.value, volume)
    ) {
      supersededVolume.current.push(pendingVolume.current);
      pendingVolume.current = undefined;
    }
    if (!Object.is(controller.getState().volume, volume)) {
      reconcileVolume(volume);
    }
  }, [controller, reconcileVolume, volume]);

  useEffect(() => {
    if (playbackRate === undefined) {
      pendingPlaybackRate.current = undefined;
      supersededPlaybackRate.current.length = 0;
      if (wasPlaybackRateControlled.current) {
        desiredPlaybackRate.current = controller.getState().playbackRate;
      }
      wasPlaybackRateControlled.current = false;
      return;
    }
    wasPlaybackRateControlled.current = true;
    if (
      pendingPlaybackRate.current &&
      !Object.is(pendingPlaybackRate.current.value, playbackRate)
    ) {
      supersededPlaybackRate.current.push(pendingPlaybackRate.current);
      pendingPlaybackRate.current = undefined;
    }
    if (!Object.is(controller.getState().playbackRate, playbackRate)) {
      reconcilePlaybackRate(playbackRate);
    }
  }, [controller, playbackRate, reconcilePlaybackRate]);

  const value = useMemo(
    () => ({
      controller,
      source: detectedSource,
      ...activation,
      registerMedia
    }),
    [activation, controller, detectedSource, registerMedia]
  );
  const posterState =
    hiddenTransition === sourceTransition ? 'hidden' : 'visible';

  return (
    <PlayerContext.Provider value={value}>
      <PosterContext.Provider value={posterState}>
        {children}
      </PosterContext.Provider>
    </PlayerContext.Provider>
  );
};

const assignRef = <Value,>(
  ref: Ref<Value> | undefined,
  value: Value | null
): (() => void) | undefined => {
  if (typeof ref === 'function') {
    const cleanup = ref(value);
    return typeof cleanup === 'function' ? cleanup : undefined;
  } else if (ref) {
    ref.current = value;
  }
};

export const Viewport = ({ children, ref, style, ...rest }: ViewportProps) => {
  const { registerViewport } = usePlayer();
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      const consumerCleanup = assignRef(ref, node);
      registerViewport(node);
      if (!node) return;
      return () => {
        if (consumerCleanup) {
          consumerCleanup();
        } else {
          assignRef(ref, null);
        }
        registerViewport(null);
      };
    },
    [ref, registerViewport]
  );
  return (
    <div
      {...rest}
      data-reely-part="viewport"
      ref={mergedRef}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {children}
    </div>
  );
};

const sourceKey = (source: ReturnType<typeof detectSource>): string =>
  source.status === 'success'
    ? JSON.stringify(source.source)
    : 'unsupported-source';

export const Media = ({ nativePoster }: MediaProps) => {
  const { mediaEligible, preload, registerMedia, source } = usePlayer();
  if (
    !mediaEligible ||
    source.status === 'failure' ||
    source.source.type !== 'video'
  ) {
    return null;
  }

  return (
    <video
      aria-label="Reely media"
      data-reely-part="media"
      key={sourceKey(source)}
      poster={nativePoster}
      playsInline
      preload={preload}
      ref={registerMedia}
      style={{ position: 'relative', zIndex: 0 }}
    >
      {source.source.sources.map(({ mimeType, src }, index) => (
        <source key={`${src}:${mimeType}:${index}`} src={src} type={mimeType} />
      ))}
    </video>
  );
};

export const Poster = ({ children, style, ...safeRest }: PosterProps) => {
  const posterState = usePosterState();

  return (
    <div
      {...safeRest}
      aria-hidden="true"
      data-reely-part="poster"
      data-state={posterState}
      style={{
        ...style,
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        pointerEvents: 'none',
        transform: 'none',
        visibility: posterState === 'hidden' ? 'hidden' : 'visible'
      }}
    >
      {children}
    </div>
  );
};

export type ActivationButtonProps = ComponentPropsWithRef<'button'>;

export const ActivationButton = ({
  'aria-label': ariaLabel,
  children,
  onClick,
  style,
  ...props
}: ActivationButtonProps) => {
  const { activateFromInteraction, loading } = usePlayer();
  const { activation, error } = usePlayerState((state) => ({
    activation: state.activation,
    error: state.error
  }));
  if (loading !== 'interaction' || activation === 'ready') return null;
  const isError = activation === 'error';
  const isLoading = activation === 'loading-provider';
  const isConfigurationError = isError && error?.category === 'configuration';
  const isDisabled = isLoading || isConfigurationError;
  const label = ariaLabel ?? (isError ? 'Retry loading video' : 'Play video');
  return (
    <button
      {...props}
      aria-disabled={isDisabled || undefined}
      aria-label={label}
      data-reely-part="activation"
      data-state={activation}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !isDisabled) {
          activateFromInteraction();
        }
      }}
      style={{
        ...style,
        position: 'absolute',
        inset: 0,
        zIndex: 30
      }}
      type="button"
    >
      {children ?? (isError ? 'Retry' : 'Play')}
    </button>
  );
};

export type LoadingIndicatorProps = ComponentPropsWithRef<'div'>;

export const LoadingIndicator = ({
  children,
  style,
  ...props
}: LoadingIndicatorProps) => {
  const { activation, buffering } = usePlayerState((state) => ({
    activation: state.activation,
    buffering: state.buffering
  }));
  const state =
    activation === 'loading-provider'
      ? 'loading-provider'
      : activation !== 'error' && buffering
        ? 'buffering'
        : null;
  if (!state) return null;
  return (
    <div
      {...props}
      aria-live="polite"
      data-reely-part="loading-indicator"
      data-state={state}
      role="status"
      style={{
        ...style,
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none'
      }}
    >
      {children ??
        (state === 'loading-provider' ? 'Loading video' : 'Buffering')}
    </div>
  );
};

type PosterImageState = 'idle' | 'loading' | 'loaded' | 'error';

const posterRequestKey = ({ src, srcSet, sizes }: PosterImageProps): string =>
  `${src ?? ''}\u0000${srcSet ?? ''}\u0000${sizes ?? ''}`;

const initialPosterImageState = (
  src?: string,
  srcSet?: string
): PosterImageState => (src || srcSet ? 'loading' : 'idle');

export const PosterImage = ({
  src,
  srcSet,
  sizes,
  width,
  height,
  loading,
  fetchPriority,
  decoding,
  objectFit,
  objectPosition,
  onLoad,
  onError,
  style,
  ...safeRest
}: PosterImageProps) => {
  const requestKey = posterRequestKey({ src, srcSet, sizes });
  const state = useRef<{
    key: string;
    state: PosterImageState;
  }>({
    key: requestKey,
    state: initialPosterImageState(src, srcSet)
  });
  const [, rerender] = useState(0);
  /* eslint-disable react-hooks/refs -- The request signature must reset visible state during this render. */
  if (state.current.key !== requestKey) {
    state.current = {
      key: requestKey,
      state: initialPosterImageState(src, srcSet)
    };
  }
  const posterImageState = state.current.state;
  /* eslint-enable react-hooks/refs */

  const updateState = (nextState: PosterImageState) => {
    if (state.current.key !== requestKey) return;
    state.current = { key: requestKey, state: nextState };
    rerender((value) => value + 1);
  };

  /* eslint-disable react-hooks/refs -- posterImageState is the synchronous keyed-state snapshot above. */
  return (
    <img
      {...safeRest}
      alt=""
      data-reely-part="poster-image"
      data-state={posterImageState}
      decoding={decoding}
      fetchPriority={fetchPriority}
      height={height}
      loading={loading}
      onError={(event) => {
        updateState('error');
        onError?.(event);
      }}
      onLoad={(event) => {
        updateState('loaded');
        onLoad?.(event);
      }}
      sizes={sizes}
      src={src}
      srcSet={srcSet}
      style={{
        ...style,
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: (objectFit ??
          'var(--reely-poster-fit, cover)') as CSSProperties['objectFit'],
        objectPosition: objectPosition ?? 'var(--reely-poster-position, center)'
      }}
      width={width}
    />
  );
  /* eslint-enable react-hooks/refs */
};

export const PlayButton = () => {
  const { autoplay, playback } = usePlayerState((state) => ({
    autoplay: state.autoplay,
    playback: state.playback
  }));
  const { controller } = usePlayer();
  const isPlaying = playback === 'playing';

  return (
    <button
      aria-label={isPlaying ? 'Pause' : 'Play'}
      data-autoplay-state={autoplay}
      data-playback-state={playback}
      onClick={() => void controller.togglePlaybackWithOrigin('user')}
      type="button"
    >
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
};
