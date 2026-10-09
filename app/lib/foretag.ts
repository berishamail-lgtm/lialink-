// Vilket företag tillhör den inloggade användaren, och i vilken roll?
//
// Ägaren har en rad i companies med sitt user_id.
// En inbjuden handledare har i stället en rad i company_members.
// Alla företagssidor ska gå via den här funktionen, annars ser handledaren
// ingenting och riskerar att skapa ett dubblettföretag.

export type MittForetag = {
  company: any | null
  /** company_members.id — null för ägaren. Matchar placements.handledare_id. */
  medlemId: string | null
  /** 'agare' | 'admin' | 'handledare' | null */
  roll: 'agare' | 'admin' | 'handledare' | null
  /** Får redigera företagsprofilen och bjuda in handledare. */
  farAdministrera: boolean
}

const tomt: MittForetag = {
  company: null,
  medlemId: null,
  roll: null,
  farAdministrera: false,
}

export async function hamtaMittForetag(
  supabase: any,
  userId: string
): Promise<MittForetag> {
  if (!userId) return tomt

  // 1. Äger användaren ett företag?
  const { data: agt } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (agt) {
    return { company: agt, medlemId: null, roll: 'agare', farAdministrera: true }
  }

  // 2. Är användaren medlem i ett? (limit 1 — en person kan i teorin
  //    vara handledare hos flera, men dashboarden visar ett i taget.)
  const { data: medlemmar } = await supabase
    .from('company_members')
    .select('id, member_role, companies(*)')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)

  const medlem = (medlemmar || [])[0]

  if (medlem?.companies) {
    const roll = medlem.member_role === 'admin' ? 'admin' : 'handledare'
    return {
      company: medlem.companies,
      medlemId: medlem.id,
      roll,
      farAdministrera: roll === 'admin',
    }
  }

  return tomt
}
