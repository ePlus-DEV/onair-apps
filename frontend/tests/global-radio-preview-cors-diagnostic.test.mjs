// Preview-only CORS/stream smoke probe. Never log URL, stream accessKey or provider body.
import test from 'node:test';
import { buildPublicTuneInRequest, inspectPublicAppleStream } from '../utils/global-radio-public-tunein.mjs';

const preview = process.env.ONAIR_PR_PREVIEW === 'true' &&
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_HEAD_REF === 'feat/tunein-apple-radio-song-history-20261105';
const origin = 'https://preview.radio.eplus.dev';
const cors = process.env.NUXT_PUBLIC_CORS_SERVER_1 || '';
const stations = ['apple-music-1', 'apple-music-holiday-hits'];

test('diagnostic only: browser-Origin proxy and live stream resolution for preview', {
  skip: !preview, timeout: 80000,
}, async () => {
  for (const stationId of stations) {
    const url = buildPublicTuneInRequest(stationId, cors);
    const report = { stationId };
    if (!url) {
      report.result = 'config_missing_or_invalid';
      console.log('APPLE_PREVIEW_CORS_PROBE', JSON.stringify(report));
      continue;
    }
    try {
      const res = await fetch(url, {
        method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit',
        headers: { Origin: origin, Accept: 'application/json' },
        signal: AbortSignal.timeout(11000),
      });
      const allow = res.headers.get('access-control-allow-origin') || '';
      report.httpStatus = res.status;
      report.corsAllowed = allow === '*' || allow === origin;
      if (res.ok) {
        const length = Number(res.headers.get('content-length') || 0);
        if (length > 262144) {
          report.result = 'oversized_response';
          await res.body?.cancel().catch(() => {});
        } else {
          const bytes = await res.arrayBuffer();
          if (bytes.byteLength > 262144) report.result = 'oversized_response';
          else {
            try {
              const payload = JSON.parse(new TextDecoder().decode(bytes));
              const options = Array.isArray(payload?.body) ? payload.body : [];
              report.providerOk = payload?.head?.status == null || Number(payload.head.status) === 200;
              report.candidates = Math.min(options.length, 50);
              const stream = options.map(x =>
                inspectPublicAppleStream(x?.url, stationId)).find(Boolean);
              report.validStream = Boolean(stream);
              if (stream) {
                try {
                  // Never log a signed HLS URL or playlist contents.
                  const manifest = await fetch(stream.streamUrl, {
                    method: 'GET', redirect: 'follow', cache: 'no-store',
                    credentials: 'omit', headers: { Origin: origin, Accept: 'application/vnd.apple.mpegurl' },
                    signal: AbortSignal.timeout(8500),
                  });
                  const hlsAllow = manifest.headers.get('access-control-allow-origin') || '';
                  report.hlsStatus = manifest.status;
                  report.hlsCorsAllowed = hlsAllow === '*' || hlsAllow === origin;
                  report.hlsOnAppleHost = new URL(manifest.url).hostname === 'itsliveradio.apple.com';
                  if (manifest.ok) {
                    const limit = Number(manifest.headers.get('content-length') || '0');
                    if (limit && limit > 196608) {
                      report.hlsManifest = 'oversized';
                      await manifest.body?.cancel().catch(() => {});
                    } else {
                      const body = await manifest.text();
                      report.hlsManifest = body.length <= 196608 && body.startsWith('#EXTM3U');
                      // Check one child media playlist (no audio fragments or tokens logged).
                      const lines = body.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
                      const masterRow = lines.findIndex(x => x.startsWith('#EXT-X-STREAM-INF:'));
                      if (report.hlsManifest && masterRow >= 0 && lines[masterRow + 1] &&
                        !lines[masterRow + 1].startsWith('#')) {
                        const child = new URL(lines[masterRow + 1], manifest.url);
                        if (child.protocol === 'https:' && child.hostname === 'itsliveradio.apple.com') {
                          try {
                            const media = await fetch(child.href, {
                              method: 'GET', redirect: 'follow', cache: 'no-store',
                              credentials: 'omit', headers: { Origin: origin, Accept: 'application/vnd.apple.mpegurl' },
                              signal: AbortSignal.timeout(8500),
                            });
                            const mediaAllow = media.headers.get('access-control-allow-origin') || '';
                            report.mediaStatus = media.status;
                            report.mediaCorsAllowed = mediaAllow === '*' || mediaAllow === origin;
                            if (media.ok) {
                              const mediaText = await media.text();
                              report.mediaManifest = mediaText.length <= 196608 && mediaText.startsWith('#EXTM3U');
                            }
                          } catch (e) {
                            report.mediaError = ['TimeoutError', 'AbortError'].includes(e?.name)
                              ? 'timeout' : 'network_or_redirect_error';
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  report.hlsError = ['TimeoutError', 'AbortError'].includes(e?.name)
                    ? 'timeout' : 'network_or_redirect_error';
                }
              }
            } catch { report.result = 'invalid_json'; }
          }
        }
      }
    } catch (e) {
      report.result = ['TimeoutError', 'AbortError'].includes(e?.name) ?
        'timeout' : 'network_or_redirect_error';
    }
    console.log('APPLE_PREVIEW_CORS_PROBE', JSON.stringify(report));
  }
});
