import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

addEventListener('fetch', event => {
  event.respondWith(handleEvent(event))
})

const DEBUG = true

async function handleEvent(event) {
  let options = {}

  if (event.request.method == "POST") {
    return handlePost(event.request)
  }

  try {
    if (DEBUG) {
      // customize caching
      options.cacheControl = {
        bypassCache: true,
      }
    }

    const page = await getAssetFromKV(event, options)

    // allow headers to be altered
    const response = new Response(page.body, page)

    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'unsafe-url')
    response.headers.set('Feature-Policy', 'none')

    return response

  } catch (e) {
    // if an error is thrown try to serve the asset at 404.html
    if (!DEBUG) {
      try {
        let notFoundResponse = await getAssetFromKV(event, {
          mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/404.html`, req),
        })

        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 })
      } catch (e) {}
    }

    return new Response(e.message || e.toString(), { status: 500 })
  }
}

const someHost = 'https://ancient-butterfly-eff0.kentiklabs.workers.dev';
const url = someHost + '/api/v1/data';

async function gatherResponse(response) {
  const { headers } = response;
  const contentType = headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return JSON.stringify(await response.json());
  } else {
    return response.text();
  }
}
async function handlePost(request) {
  const query = {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({target: "https://apple.com"})
  };
  const res = {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  };

  console.log(url);
  consule.log(query);

  const response = await fetch(url, query);
  const results = await gatherResponse(response);

  console.log(results);

  return new Response(results, res);
}
