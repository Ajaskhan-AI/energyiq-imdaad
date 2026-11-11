import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 text-navy-500">This page does not exist in the demo.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
      >
        Back to my home page
      </Link>
    </div>
  )
}
