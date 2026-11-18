import { FOOTER } from '../config.js'

export default function Footer() {
  return (
    <footer className="app-footer">
      <span>Powered by {FOOTER.poweredBy}</span>
      <span>
        Email: <a href={`mailto:${FOOTER.email}`}>{FOOTER.email}</a>
      </span>
      <span>
        Mobile no.: <a href={`tel:${FOOTER.mobile.tel}`}>{FOOTER.mobile.label}</a>
      </span>
      <span>
        Telephone: <a href={`tel:${FOOTER.telephone.tel}`}>{FOOTER.telephone.label}</a>
      </span>
      <span>
        Facebook:{' '}
        <a href={FOOTER.facebook.url} target="_blank" rel="noopener noreferrer">
          {FOOTER.facebook.label}
        </a>
      </span>
    </footer>
  )
}
