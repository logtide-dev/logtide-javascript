export default defineNuxtConfig({
  // Note: @logtide/nuxt module is not used here because the runtime
  // plugins are not included in the built dist/. Instead, we initialize
  // the SDK directly via a Nitro server plugin (see server/plugins/).
  runtimeConfig: {
    logtide: {
      dsn: process.env.LOGTIDE_DSN ?? 'http://lp_testkey@127.0.0.1:9102/test-project',
      service: 'test-nuxt',
      environment: 'test',
      batchSize: 1,
      flushInterval: 500,
    },
  },
  devtools: { enabled: false },
});
