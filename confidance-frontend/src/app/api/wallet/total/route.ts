import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  try {
    const accessKey = process.env.DEBANK_ACCESS_KEY;
    const isPro = Boolean(accessKey);
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isPro
      ? 'https://pro-openapi.debank.com/v1/user/total_balance'
      : 'https://open-api.debank.com/v1/user/total_balance';

    const response = await fetch(
      `${baseUrl}?id=${encodeURIComponent(address.toLowerCase())}`,
      {
        cache: 'no-store',
        headers: {
          'accept': 'application/json',
          'user-agent': 'Confidance/1.0 (+https://confidance.app)',
          ...(accessKey ? { AccessKey: accessKey } : {}),
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Debank upstream error:', response.status, errorBody);
      return NextResponse.json(
        {
          error: 'Upstream error',
          status: response.status,
          body: errorBody.slice(0, 500),
          provider: isPro ? 'debank-pro' : 'debank-open',
          ...(isDev
            ? {
                debug: {
                  hasAccessKey: isPro,
                  accessKeyLength: accessKey?.length ?? 0,
                  endpoint: baseUrl,
                },
              }
            : {}),
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawTotal = data?.total_usd_value;
    const totalUsd = typeof rawTotal === 'number'
      ? rawTotal
      : typeof rawTotal === 'string'
        ? Number.parseFloat(rawTotal)
        : null;

    return NextResponse.json({
      totalUsd: Number.isFinite(totalUsd) ? totalUsd : null,
      source: isPro ? 'debank-pro' : 'debank-open',
      ...(isDev
        ? {
            debug: {
              hasAccessKey: isPro,
              accessKeyLength: accessKey?.length ?? 0,
              endpoint: baseUrl,
            },
          }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
