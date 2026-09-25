import { Client } from "pg";

export async function withPostgresClient<T>(
  database: Hyperdrive,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: database.connectionString,
  });

  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
