import { SignIn, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950 p-6">
      <main className="flex flex-col items-center gap-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-10 rounded-2xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          DevTrack V2 Auth Portal
        </h1>
        
        <SignedOut>
          <p className="text-zinc-600 dark:text-zinc-400 -mt-4">
            Sign in to retrieve your Clerk JWT token for API testing.
          </p>
          <SignIn routing="hash" />
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-center gap-3">
              <span className="text-zinc-600 dark:text-zinc-400">Authenticated as:</span>
              <UserButton showName />
            </div>
            
            <div className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 p-5 rounded-xl text-left">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                How to copy your Clerk JWT token:
              </p>
              <ol className="list-decimal list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li>Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded">F12</kbd> or right-click &rarr; <b>Inspect</b></li>
                <li>Go to the <b>Console</b> tab</li>
                <li>Paste and run the command below</li>
              </ol>
              
              <div className="bg-zinc-900 text-zinc-100 p-3 rounded-md font-mono text-xs select-all overflow-x-auto">
                await window.Clerk.session.getToken()
              </div>
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
