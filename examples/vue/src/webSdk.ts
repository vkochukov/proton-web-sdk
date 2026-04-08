import ProtonWebSDK, { setUITheme, runUIDemo } from '@proton/web-sdk'
import type { ProtonWebLink, LinkSession, TransactResult, Link } from '@proton/web-sdk'
import { Serialize, JsonRpc } from '@proton/js'
import type { RpcInterfaces } from '@proton/js'

export let link: ProtonWebLink | Link | undefined
export let session: LinkSession | undefined

const USE_PULSE_VM = import.meta.env.VITE_USE_PULSE_VM === 'true'
const REQUEST_ACCOUNT = 'taskly'
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID
const ENDPOINTS = (
  import.meta.env.VITE_ENDPOINTS ||
  (USE_PULSE_VM
    ? 'https://a-chain-alpine.metalblockchain.org/ext/bc/6v9NieZiX3e8eQz3CyJMtXB6YzV2RtnxcRyLAmSgFWWk5Qs6y/rpc'
    : 'https://proton.greymass.com')
)
  .split(',')
  .map((endpoint: string) => endpoint.trim())
  .filter(Boolean)
export const HYPERION_ENDPOINT =
  import.meta.env.VITE_HYPERION_ENDPOINT || 'https://a-chain-alpine-hyperion.metalblockchain.org'
const TOKEN_CONTRACT = import.meta.env.VITE_TOKEN_CONTRACT || (USE_PULSE_VM ? 'pulse.token' : 'eosio.token')
const TOKEN_SYMBOL = import.meta.env.VITE_TOKEN_SYMBOL || 'XPR'
const TOKEN_PRECISION = Number(import.meta.env.VITE_TOKEN_PRECISION || '4')

const rpc = new JsonRpc(ENDPOINTS)

export const createLink = async ({
  restoreSession = false,
}: {
  restoreSession?: boolean
}): Promise<void> => {
  const { link: localLink, session: localSession } = await ProtonWebSDK({
    linkOptions: {
      endpoints: ENDPOINTS,
      ...(CHAIN_ID ? { chainId: CHAIN_ID } : {}),
      usePulseVM: USE_PULSE_VM,
      restoreSession,
    },
    transportOptions: {
      requestAccount: REQUEST_ACCOUNT,
    },
    selectorOptions: {},
    uiOptions: {
      appInfo: {
        name: 'Taskly',
      },
    },
  })
  link = localLink
  session = localSession
}

export const login = async (): Promise<LinkSession | undefined> => {
  await createLink({ restoreSession: false })
  if (session) {
    return session
  }
}

export const transact = async (
  actions: Serialize.Action[],
  broadcast: boolean,
): Promise<TransactResult> => {
  if (session) {
    return session.transact(
      {
        transaction: {
          actions,
        } as never,
      },
      { broadcast },
    )
  } else {
    throw new Error('No Session')
  }
}

export const logout = async (): Promise<void> => {
  if (session) {
    await session.remove()
  }
  session = undefined
  link = undefined
}

export const reconnect = async (): Promise<LinkSession | undefined> => {
  if (!session) {
    await createLink({ restoreSession: true })
  }

  if (session) {
    return session
  }
}

export const transfer = async ({ to, amount }: { to: string; amount: string }) => {
  if (!session) {
    throw new Error('No Session')
  }

  try {
    return await session.transact(
      {
        actions: [
          {
            /**
             * The token contract, precision and symbol for tokens can be seen at protonscan.io/tokens
             */

            // Token contract
            account: TOKEN_CONTRACT,

            // Action name
            name: 'transfer',

            // Action parameters
            data: {
              // Sender
              from: session.auth.actor,

              // Receiver
              to: to,

              // 4 is precision, XPR is symbol
              quantity: `${(+amount).toFixed(TOKEN_PRECISION)} ${TOKEN_SYMBOL}`,

              // Optional memo
              memo: '',
            },
            authorization: [session.auth],
          },
        ],
      },
      {
        broadcast: true,
      },
    )
  } catch (error) {
    console.log('GOT ERROR', error, (error as any).json)
    throw error
  }
}

export async function getProtonAvatar(
  account: string,
): Promise<RpcInterfaces.UserInfo | undefined> {
  if (USE_PULSE_VM) {
    return undefined
  }

  try {
    const result = await rpc.get_table_rows({
      code: 'eosio.proton',
      scope: 'eosio.proton',
      table: 'usersinfo',
      key_type: 'i64',
      lower_bound: account,
      index_position: 1,
      limit: 1,
    })

    if (result.rows.length > 0 && result.rows[0].acc === account) {
      return result.rows[0]
    }
  } catch (e) {
    console.error('getProtonAvatar error', e)
  }

  return undefined
}

function setTheme() {
  setUITheme('my')
}

function runDemo() {
  runUIDemo()
}

export default {
  link,
  login,
  transact,
  logout,
  reconnect,
  transfer,
  setTheme,
  runDemo,
}
