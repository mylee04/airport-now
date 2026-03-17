import { handleAppRequest } from '../backend/src/app-handler';

function buildRewrittenRequest(request: Request): Request {
  const currentUrl = new URL(request.url);
  const pathname = currentUrl.searchParams.get('pathname');

  if (!pathname) {
    return request;
  }

  currentUrl.pathname = pathname;
  currentUrl.searchParams.delete('pathname');

  return new Request(currentUrl, request);
}

export default {
  async fetch(request: Request): Promise<Response> {
    return handleAppRequest(buildRewrittenRequest(request));
  },
};
