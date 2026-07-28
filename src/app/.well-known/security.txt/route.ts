// RFC 9116 security.txt -- tells anyone who finds a real vulnerability how
// to report it responsibly instead of disclosing it publicly first.
// https://securitytxt.org/
const SECURITY_TXT = `Contact: https://github.com/mikeschim12/Asteroids-Royale/security/advisories/new
Expires: 2027-07-01T00:00:00.000Z
Preferred-Languages: en
Canonical: https://royale.rocks/.well-known/security.txt
`;

export function GET() {
  return new Response(SECURITY_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
