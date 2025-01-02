import React, { type PropsWithChildren, useMemo } from 'react'

import { useWorklet } from 'react-native-worklets-core'
import {
  Configurator,
  type RendererConfigProps,
  type ViewConfigProps,
} from 'react-native-filament/lib/typescript/src/react/Configurator'
import {
  FilamentContext,
  type FilamentContextType,
} from 'react-native-filament/lib/typescript/src/hooks/useFilamentContext'
import { RenderCallbackContext, useDisposableResource } from 'react-native-filament'

import { type EngineProps, useEngine } from './hooks/useEngine'
import { FilamentProxy, FilamentWorkletContext } from './web/FilamentProxy'

export type FilamentProviderProps = PropsWithChildren<
  Omit<EngineProps, 'context'> &
    ViewConfigProps &
    RendererConfigProps & {
      fallback?: React.ReactElement
    }
>

/**
 * The `<FilamentScene>` holds contextual values for a Filament rendering scene.
 *
 * You need to wrap your rendering scene (= a component that uses `<FilamentView>`, hooks or
 * other Filament components) with a `<FilamentScene>`.
 *
 * @note Make sure to wrap your scene in a parent component, otherwise the React context cannot be inferred.
 * @example
 * ```tsx
 * function Scene() {
 *   // in here you can use Filament's hooks and components
 *   return (
 *    <FilamentView style={styles.container}>
 *      <DefaultLight />
 *      <Model source={{ uri: modelPath }} />
 *    </FilamentView>
 *  )
 * }
 *
 * export function RocketModel() {
 *   // in here you only need to wrap the child-component with <FilamentScene>
 *   return (
 *     <FilamentScene>
 *       <Scene />
 *     </FilamentScene>
 *   )
 * }
 * ```
 */
export function FilamentScene({ children, ...viewProps }: FilamentProviderProps) {
  const { frameRateOptions, fallback } = viewProps
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  const engine = useEngine({ canvas: canvasRef.current, context: FilamentWorkletContext })

  // Create all Filament APIs using the engine
  const transformManager = useDisposableResource(
    () => Promise.resolve(engine?.createTransformManager()),
    [engine],
  )
  const renderableManager = useDisposableResource(
    () => Promise.resolve(engine?.createRenderableManager()),
    [engine],
  )
  const scene = useDisposableResource(() => Promise.resolve(engine?.getScene()), [engine])
  const lightManager = useDisposableResource(
    () => Promise.resolve(engine?.createLightManager()),
    [engine],
  )
  const view = useDisposableResource(() => Promise.resolve(engine?.getView()), [engine])
  const camera = useDisposableResource(() => Promise.resolve(engine?.getCamera()), [engine])
  const renderer = useDisposableResource(() => Promise.resolve(engine?.createRenderer()), [engine])
  const nameComponentManager = useDisposableResource(
    () => Promise.resolve(engine?.createNameComponentManager()),
    [engine],
  )

  // Create a choreographer for this context tree
  const choreographer = useDisposableResource(
    useWorklet(FilamentWorkletContext, () => {
      'worklet'
      return FilamentProxy.createChoreographer()
    }),
  )

  // Construct the context object value:
  const value = useMemo<FilamentContextType | undefined>(() => {
    if (
      transformManager == null ||
      renderableManager == null ||
      scene == null ||
      lightManager == null ||
      view == null ||
      camera == null ||
      renderer == null ||
      nameComponentManager == null ||
      choreographer == null ||
      engine == null
    ) {
      return undefined
    }

    return {
      engine,
      transformManager,
      renderableManager,
      scene,
      lightManager,
      view,
      camera,
      renderer,
      nameComponentManager,
      workletContext: FilamentWorkletContext,
      choreographer: choreographer,
    }
  }, [
    transformManager,
    renderableManager,
    scene,
    lightManager,
    view,
    camera,
    renderer,
    nameComponentManager,
    choreographer,
    engine,
  ])

  const rendererProps = useMemo(() => ({ frameRateOptions }), [frameRateOptions])

  // If the APIs aren't ready yet render the fallback component (or nothing)
  if (value == null) return fallback ?? null
  return (
    <FilamentContext.Provider value={value}>
      <Configurator rendererProps={rendererProps} viewProps={viewProps}>
        <RenderCallbackContext.RenderContextProvider>
          <canvas ref={canvasRef} />
          {children}
        </RenderCallbackContext.RenderContextProvider>
      </Configurator>
    </FilamentContext.Provider>
  )
}
