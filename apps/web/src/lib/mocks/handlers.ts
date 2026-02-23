import { http, HttpResponse } from 'msw';
import { mockUniverse } from '$lib/api/mock';

export const handlers = [
	http.get('/v3/universe', () => {
		return HttpResponse.json(mockUniverse);
	})
];
