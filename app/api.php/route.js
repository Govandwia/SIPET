import { handleRequest } from "../api/sensor/route";

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}
