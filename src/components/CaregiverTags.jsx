import { credentialState } from '../lib/criteria.js'

/** Compact, text-only summary of a caregiver's qualifications, plus credential alerts. */
export default function CaregiverTags({ cg }) {
  const tags = [
    cg.level,
    cg.gender,
    cg.driver,
    ...(cg.skills || []),
    ...(cg.languages || []).filter((l) => l !== 'English'),
    ...(cg.availability || []),
  ].filter(Boolean)
  const creds = cg.credentials || []
  const expired = creds.filter((c) => credentialState(c) === 'expired').map((c) => c.type)
  const renew = creds.filter((c) => credentialState(c) === 'renew').map((c) => c.type)
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
      {cg.doNotAssign && <span className="tag tag-danger">Do not assign</span>}
      {expired.length > 0 && <span className="tag tag-danger">Expired: {expired.join(', ')}</span>}
      {renew.length > 0 && <span className="tag tag-warning">Renew: {renew.join(', ')}</span>}
    </span>
  )
}
