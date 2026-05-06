export const LEVEL_OPTIONS = [
  { value: 'sp_4_6',   label: 'Szkoła podstawowa (kl. 4–6)' },
  { value: 'sp_7_8',   label: 'Szkoła podstawowa (kl. 7–8)' },
  { value: 'liceum_1', label: 'I klasa liceum / technikum' },
  { value: 'liceum_2', label: 'II klasa liceum / technikum' },
  { value: 'liceum_3', label: 'III klasa liceum / technikum' },
  { value: 'matura',   label: 'Matura' },
  { value: 'studia',   label: 'Studia' },
  { value: 'inne',     label: 'Inne (wpisz poniżej)' },
] as const

export const SCOPE_OPTIONS = [
  { value: 'new_material', label: 'Nowy materiał' },
  { value: 'homework',     label: 'Praca domowa' },
  { value: 'test_prep',    label: 'Sprawdzian / kartkówka' },
  { value: 'matura_prep',  label: 'Przygotowanie do matury' },
  { value: 'repeat',       label: 'Powtórzenie materiału' },
  { value: 'inne',         label: 'Inne (wpisz poniżej)' },
] as const

type Option = { value: string; label: string }

/** Zwraca label dla wybranej opcji lub tekst wpisany ręcznie gdy wybrano "inne". */
export function resolveOption(
  options: readonly Option[],
  value: string,
  otherValue: string
): string {
  if (value === 'inne') return otherValue.trim()
  return options.find((o) => o.value === value)?.label ?? value
}
