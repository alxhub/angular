import {RenderFlags} from '..';
import {retrieveHydrationInfo} from '../../hydration/utils';
import {assertEqual, assertNotReactive} from '../../util/assert';
import {
  CONTEXT,
  FLAGS,
  HYDRATION,
  LView,
  LViewFlags,
  QUERIES,
  TView,
  INJECTOR,
  TVIEW,
  HOST,
} from '../interfaces/view';
import {enterView, leaveView, restoreLFrame, saveLFrame} from '../state';
import {getComponentLViewByIndex, isCreationMode} from '../util/view_utils';
import {syncViewWithBlueprint} from './render';
import {executeTemplate, executeViewQueryFn, refreshContentQueries} from './shared';

export function* renderComponentAsync(hostLView: LView, componentHostIdx: number): Generator {
  ngDevMode && assertEqual(isCreationMode(hostLView), true, 'Should be run in creation mode');
  const componentView = getComponentLViewByIndex(componentHostIdx, hostLView);
  const componentTView = componentView[TVIEW];
  syncViewWithBlueprint(componentTView, componentView);

  const hostRNode = componentView[HOST];
  // Populate an LView with hydration info retrieved from the DOM via TransferState.
  if (hostRNode !== null && componentView[HYDRATION] === null) {
    componentView[HYDRATION] = retrieveHydrationInfo(hostRNode, componentView[INJECTOR]!);
  }

  yield* renderViewAsync(componentTView, componentView, componentView[CONTEXT]);
}

/**
 * Processes a view in the creation mode. This includes a number of steps in a specific order:
 * - creating view query functions (if any);
 * - executing a template function in the creation mode;
 * - updating static queries (if any);
 * - creating child components defined in a given view.
 */
export function* renderViewAsync<T>(tView: TView, lView: LView<T>, context: T): Generator {
  ngDevMode && assertEqual(isCreationMode(lView), true, 'Should be run in creation mode');
  ngDevMode && assertNotReactive(renderViewAsync.name);

  const frame = saveLFrame();
  yield;
  restoreLFrame(frame);

  enterView(lView);
  try {
    const viewQuery = tView.viewQuery;
    if (viewQuery !== null) {
      executeViewQueryFn<T>(RenderFlags.Create, viewQuery, context);
    }

    // Execute a template associated with this view, if it exists. A template function might not be
    // defined for the root component views.
    const templateFn = tView.template;
    if (templateFn !== null) {
      executeTemplate<T>(tView, lView, templateFn, RenderFlags.Create, context);
    }

    // This needs to be set before children are processed to support recursive components.
    // This must be set to false immediately after the first creation run because in an
    // ngFor loop, all the views will be created together before update mode runs and turns
    // off firstCreatePass. If we don't set it here, instances will perform directive
    // matching, etc again and again.
    if (tView.firstCreatePass) {
      tView.firstCreatePass = false;
    }

    // Mark all queries active in this view as dirty. This is necessary for signal-based queries to
    // have a clear marking point where we can read query results atomically (for a given view).
    lView[QUERIES]?.finishViewCreation(tView);

    // We resolve content queries specifically marked as `static` in creation mode. Dynamic
    // content queries are resolved during change detection (i.e. update mode), after embedded
    // views are refreshed (see block above).
    if (tView.staticContentQueries) {
      refreshContentQueries(tView, lView);
    }

    // We must materialize query results before child components are processed
    // in case a child component has projected a container. The LContainer needs
    // to exist so the embedded views are properly attached by the container.
    if (tView.staticViewQueries) {
      executeViewQueryFn<T>(RenderFlags.Update, tView.viewQuery!, context);
    }

    // Render child component views.
    const components = tView.components;
    if (components !== null) {
      yield* renderChildComponentsAsync(lView, components);
    }
  } catch (error) {
    // If we didn't manage to get past the first template pass due to
    // an error, mark the view as corrupted so we can try to recover.
    if (tView.firstCreatePass) {
      tView.incompleteFirstPass = true;
      tView.firstCreatePass = false;
    }

    throw error;
  } finally {
    lView[FLAGS] &= ~LViewFlags.CreationMode;
    leaveView();
  }
}

/** Renders child components in the current view (creation mode). */
function* renderChildComponentsAsync(hostLView: LView, components: number[]): Generator {
  for (let i = 0; i < components.length; i++) {
    yield* renderComponentAsync(hostLView, components[i]);
  }
}
