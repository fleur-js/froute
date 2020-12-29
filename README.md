# Froute

Framework independent Router for React.
Can use with both Fleur / Redux (redux-thunk).

## Features

See all examples in [this spec](https://github.com/fleur-js/froute/blob/master/src/index.spec.tsx) or [examples](https://github.com/fleur-js/froute/tree/master/examples)

- Library independent
  - Works with Redux and Fleur
- Next.js's Router subset compatiblity
- Supports dynamic import without any code transformer
- Supports Sever Side Rendering
  - Supports preload
  - `ResponseCode` and `Redirect` component
- Custom route resolution (for i18n support)
- URL Builder

### Next.js compat status

- Compat API via `useRouter` or `withRouter`
  - Compatible features
    - `pathname`, `query`, `push()`, `replace()`, `prefetch()`, `back()`, `reload()`
- Next.js specific functions not supported likes `asPath`, `isFallback`, `basePath`, `locale`, `locales` and `defaultLocale`
  - `router.push()`, `router.replace()`
    - URL Object is does not support currentry
    - `as` argument is not supported
  - `router.beforePopState` is not supported
    - Use `useBeforeRouteChange()` hooks instead
  - All `router.events` not supported currently

### Hooks

- useRouteComponent
- useLocation
- useNavigation
- useParams
- useUrlBuilder(routeDefinition, params, query?): string
- useBeforeRouteChange(listener: () => Promise&lt;boolean | void&gt; | boolean | void )
  - It can prevent routing

### Components

- Link
- ResponseCode
- Redirect

## Example

Route definition:
```tsx
export const routes = {
  index: routeBy('/').action({
    component: () => import('./pages/index'),
  }),
  user: routeBy('/users').param('userId').action({
    component: () => import('./pages/user'),
    preload: (store: Store, param) => Promise.all([ store.dispatch(fetchUser(param.userId)) ]),
  })
}
```

App:
```tsx
import { useRouteComponent, ResponseCode } from '@fleur/froute'

export const App = () => {
  const { PageComponent } = useRouteComponent()

  return (
    <div>
      {PageComponent ? (
        <PageComponent /> 
      ) : (
        <ResponseCode status={404}>
          <NotFound />
        </ResponseCode>
      )}
    </div>
  )
}
```

User.tsx:
```tsx
import { routes, ResponseCode, Redirect } from './routes'

export default () => {
  // Use typeof to circular dependency free
  const { userId } = useParams<typeof routes.user>()
  const { urlBuilder } = useUrlBuilder()
  const user = useSelector(getUser(userId))

  if (!user) {
    return (
      <ResponseCode status={404}>
        <NotFound />
      </ResponseCode>
    )
  }

  if (!user.suspended) {
    return (
      <Redirect status={301} url='/'>
        This account is suspended.
      </Redirect>
    )
  }
  
  return (
    <div>
      Hello, {user.name}!
      <br />
      <Link href={urlBuilder(routes.user, { userId: '2' })}>
        Show latest update friend
      </Link>
    </div>
  )
}
```


Server side:
```tsx
import { createRouterContext } from '@fleur/froute'
import { routes } from './routes'

server.get("*", async (req, res, next) => {
  const router = createRouterContext(routes, {
    preloadContext: store
  })

  router.navigate(req.url)
  await context.preloadCurrent();

  const content = ReactDOM.renderToString(
    <FrouteContext router={router}>
      <App />
    </FrouteContext>
  )

  // Handling redirect
  if (router.redirectTo) {
    res.redirect(router.statusCode, router.redirectTo)
  } else{
    res.status(router.statusCode)
  }
  
  const stream = ReactDOM.renderToNodeStream(
    <Html>
      {content}
    </Html>
  ).pipe(res)
})
```

Client side:
```tsx
import { createRouterContext, FrouteContext } from '@fleur/froute'

domready(async () => {
  const router = createRouterContext(routes, {
    preloadContext: store,
  });

  route.navigate(location.href)

  ReactDOM.render((
      <FrouteContext router={router}>
        <App />
      </FrouteContext>
    ),
    document.getElementById('root')
  )
})
```
