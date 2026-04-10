export default {
  async fetch(): Promise<Response> {
    return new Response("Not implemented", { status: 501 });
  },
} satisfies ExportedHandler<Env>;
