import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
} from "react";
import qs from "querystring";
import { canUseDOM, DeepReadonly, isDevelopment } from "./utils";
import { RouteDefinition, ParamsOfRoute, StateOfRoute } from "./RouteDefiner";
import { NavigationListener, RouterContext } from "./RouterContext";

const useIsomorphicEffect = canUseDOM() ? useLayoutEffect : useEffect;

const Context = createContext<RouterContext | null>(null);
Context.displayName = "FrouteContext";

export const FrouteContext = ({
  router,
  children,
}: {
  router: RouterContext;
  children: ReactNode;
}) => {
  useIsomorphicEffect(() => {
    const observer: NavigationListener = async (location) => {
      window.scrollTo({
        left: location.state.__froute.scrollX,
        top: location.state.__froute.scrollY,
      });
    };

    router.observeRouteChanged(observer);
    return () => router.unobserveRouteChanged(observer);
  }, [router]);

  // Save scroll position
  useEffect(() => {
    let scrollTimerId: number;

    const handleScroll = () => {
      if (scrollTimerId) {
        clearTimeout(scrollTimerId);
      }

      scrollTimerId = (setTimeout(() => {
        const location = router.getCurrentLocation();
        if (!location) return;

        router.internalHistoryState = {
          scrollX: window.scrollX || window.pageXOffset,
          scrollY: window.scrollY || window.pageYOffset,
        };
      }, 150) as any) as number;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimerId);
    };
  }, []);

  return <Context.Provider value={router}>{children}</Context.Provider>;
};

/**
 * Do not expose to public API. It's Froute internal only hooks.
 * WHY: Protect direct router operating from Components.
 * If allow it, Router status can changed by anywhere and becomes unpredictable.
 */
export const useRouterContext = () => {
  const router = useContext(Context);
  if (!router) {
    throw new Error("FrouteContext must be placed of top of useRouter");
  }

  return router;
};

export const useRouteComponent = () => {
  const router = useRouterContext();
  const match = router.getCurrentMatch();
  const PageComponent = match?.route.getActor()?.cachedComponent;
  const [, rerender] = useReducer((s) => s + 1, 0);

  useIsomorphicEffect(() => {
    router.observeRouteChanged(rerender);
    return () => router.unobserveRouteChanged(rerender);
  }, [router, rerender]);

  useIsomorphicEffect(() => {
    router.observeRouteChanged(rerender);
    return () => router.unobserveRouteChanged(rerender);
  }, []);

  return useMemo(() => ({ PageComponent }), [match]);
};

export const useLocation = <R extends RouteDefinition<any, any>>(
  expectRoute?: R
) => {
  const router = useRouterContext();
  const location = router.getCurrentLocation();

  if (
    isDevelopment &&
    expectRoute &&
    router.getCurrentMatch()?.route !== expectRoute
  ) {
    console.warn(
      "Froute: Expected route and current route not matched in `useLocation`"
    );
  }

  return useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      query: qs.parse(location.search.slice(1) ?? ""),
      hash: location.hash,
      state: location.state.app as StateOfRoute<R>,
    }),
    [location.pathname, location.search, location.search]
  );
};

export const useHistoryState = <
  R extends RouteDefinition<any, any> = RouteDefinition<any, any>
>(
  expectRoute?: R
): [
  getHistoryState: () => DeepReadonly<StateOfRoute<R>>,
  setHistoryState: (state: StateOfRoute<R>) => void
] => {
  const router = useRouterContext();

  if (
    isDevelopment &&
    expectRoute &&
    router.getCurrentMatch()?.route !== expectRoute
  ) {
    console.warn(
      "Froute: Expected route and current route not matched in `useHistoryContext`"
    );
  }

  return useMemo(() => [router.getHistoryState, router.setHistoryState], []);
};

interface UseParams {
  (): { [param: string]: string | undefined };
  <T extends RouteDefinition<any, any>>(route: T): ParamsOfRoute<T>;
}

export const useParams: UseParams = <
  T extends RouteDefinition<any, any> = RouteDefinition<any, any>
>(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  route?: T
) => {
  const router = useRouterContext();
  const location = router.getCurrentLocation();
  const match = location ? router.resolveRoute(location.pathname) : null;

  return match ? (match.match.params as ParamsOfRoute<T>) : {};
};

interface FrouteNavigator {
  push<R extends RouteDefinition<any, any>>(
    route: R,
    params: ParamsOfRoute<R>,
    extra: {
      query?: { [key: string]: string | string[] };
      hash?: string;
      state?: StateOfRoute<R>;
    }
  ): void;
  push(pathname: string): void;
  replace<R extends RouteDefinition<any, any>>(
    route: R,
    params: ParamsOfRoute<R>,
    extra: {
      query?: { [key: string]: string | string[] };
      hash?: string;
      state?: StateOfRoute<R>;
    }
  ): void;
  replace(pathname: string): void;
  back(): void;
  forward(): void;
}

export const useNavigation = () => {
  const router = useRouterContext();
  const { buildPath } = useUrlBuilder();

  return useMemo<FrouteNavigator>(
    () => ({
      push: <R extends RouteDefinition<any, any>>(
        route: R | string,
        params: ParamsOfRoute<R> = {} as any,
        {
          query,
          hash = "",
          state,
        }: {
          query?: { [key: string]: string | string[] };
          hash?: string;
          state?: StateOfRoute<R>;
        } = {}
      ) => {
        const pathname =
          typeof route === "string" ? route : buildPath(route, params, query);

        router.navigate(pathname + hash, {
          state,
          action: "PUSH",
        });
      },
      replace: <R extends RouteDefinition<any, any>>(
        route: R | string,
        params: ParamsOfRoute<R> = {} as any,
        {
          query,
          hash = "",
          state,
        }: {
          query?: { [key: string]: string | string[] };
          hash?: string;
          state?: StateOfRoute<R>;
        } = {}
      ) => {
        const pathname =
          typeof route === "string" ? route : buildPath(route, params, query);

        router.navigate(pathname + hash, {
          state,
          action: "REPLACE",
        });
      },
      back: () => router.history.back(),
      forward: () => router.history.forward(),
    }),
    [router, router.history]
  );
};

export const useUrlBuilder = () => {
  const router = useRouterContext();
  return useMemo(
    () => ({
      buildPath: router.buildPath,
    }),
    [router]
  );
};
