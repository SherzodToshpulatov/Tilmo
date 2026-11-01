import { ApiError, errorResponse, jsonResponse } from './errors';
import { handleTranslate, type TranslateDependencies } from './routes/translate';

export async function handleRequest(request: Request, getDependencies: () => TranslateDependencies): Promise<Response> {
  try {
    const { pathname } = new URL(request.url);

    if (pathname === '/v1/health') {
      if (request.method !== 'GET') throw new ApiError(405, 'method_not_allowed', 'Use GET.', { allow: 'GET' });
      return jsonResponse({ status: 'ok' });
    }

    if (pathname === '/v1/translate') {
      if (request.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Use POST.', { allow: 'POST' });
      return await handleTranslate(request, getDependencies());
    }

    throw new ApiError(404, 'not_found', 'Not found.');
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error('unhandled_error', { name: error instanceof Error ? error.name : typeof error });
    return errorResponse(new ApiError(500, 'internal_error', 'An unexpected error occurred.'));
  }
}
