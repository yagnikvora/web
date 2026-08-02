/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` and `next dev` both write to `.next`, so running a production build while
  // a dev server is up replaces the files that server is serving from and it starts
  // answering 500 `Cannot find module './948.js'` for every route — with nothing in the
  // source to explain it. Setting NEXT_DIST_DIR gives the build its own directory:
  //
  //   NEXT_DIST_DIR=.next-prod npx next build && NEXT_DIST_DIR=.next-prod npx next start
  //
  // Unset, this is exactly the default, so nothing changes for anyone who does not use it.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
