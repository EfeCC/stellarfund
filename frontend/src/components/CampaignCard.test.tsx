import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CampaignStatus } from '../contracts/campaign'
import type { Campaign } from '../services/soroban'
import { CampaignCard } from './CampaignCard'

const XLM = 10_000_000n

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    address: 'CC3O752IQUHES6SSNARFCTRQSOJJWNUI7FCTGNI2STVNPTGB7OI7I2QL',
    creator: 'GDD5YXT3WW6GOGGTVCTP6TXGR2B7OWKK247KYCWXRUSMOZ2TOJU73ORY',
    token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    factory: 'CDHZUBWTRT53NQKJKJCOXWKM5BITXPYYHWKLQYWQNKJMVNNXDPJT3Z57',
    title: 'Open Source Fund',
    description: 'Keeping the Stellar developer tooling maintained.',
    goal: 1_000n * XLM,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3 * 86_400),
    raised: 250n * XLM,
    contributors: 4,
    status: CampaignStatus.Active,
    ...overrides,
  }
}

function renderCard(campaign: Campaign) {
  return render(
    <MemoryRouter>
      <CampaignCard campaign={campaign} />
    </MemoryRouter>,
  )
}

describe('CampaignCard', () => {
  it('shows the campaign and how far along it is', () => {
    renderCard(makeCampaign())

    expect(screen.getByText('Open Source Fund')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('/ 1,000 XLM')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  })

  it('links to the campaign contract, which is its own address', () => {
    const campaign = makeCampaign()
    renderCard(campaign)

    expect(screen.getByRole('link')).toHaveAttribute('href', `/campaign/${campaign.address}`)
  })

  it('counts down while the campaign is live', () => {
    renderCard(makeCampaign())
    expect(screen.getByText('3 days left')).toBeInTheDocument()
  })

  it('shows backers rather than a countdown once it has closed', () => {
    renderCard(makeCampaign({ status: CampaignStatus.Withdrawn, contributors: 12 }))

    expect(screen.getByText('12 backers')).toBeInTheDocument()
    expect(screen.getByText('Funded')).toBeInTheDocument()
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument()
  })

  it('caps the progress bar at 100% when a campaign overfunds', () => {
    renderCard(
      makeCampaign({ raised: 2_500n * XLM, goal: 1_000n * XLM, status: CampaignStatus.Successful }),
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Goal reached')).toBeInTheDocument()
  })

  it('flags a missed campaign as refundable', () => {
    renderCard(makeCampaign({ status: CampaignStatus.Failed }))
    expect(screen.getByText('Refundable')).toBeInTheDocument()
  })
})
