/** Compact, text-only summary of a caregiver's qualifications. */
export default function CaregiverTags({ cg }) {
  const tags = [
    cg.level,
    cg.gender,
    cg.driver,
    ...(cg.skills || []),
    ...(cg.languages || []).filter((l) => l !== 'English'),
    ...(cg.availability || []),
  ].filter(Boolean)
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
      {cg.doNotAssign && <span className="tag tag-danger">Do not assign</span>}
    </span>
  )
}
