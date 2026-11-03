import { DataSource } from 'typeorm';
import {
  MEMBER_COMPANY_KINDS,
  OWNED_COMPANY_KINDS,
} from '../../../../profiles.constants';
import { ProfileRelationalRepository } from './profile.repository';

describe('ProfileRelationalRepository.findCompanies', () => {
  let query: jest.Mock;
  let repository: ProfileRelationalRepository;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    repository = new ProfileRelationalRepository({
      query,
    } as unknown as DataSource);
  });

  it('should list only business kinds as owned, and authorities too for memberships', async () => {
    await repository.findCompanies(13, 9, 100);

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values).toContainEqual([
      'head_office',
      'branch',
      'self_employed',
      'for_sale',
    ]);
    expect(values).toContainEqual([
      'head_office',
      'branch',
      'self_employed',
      'for_sale',
      'authority',
    ]);
    // each branch of the UNION filters by its own list
    expect(sql.match(/p\."kind" = ANY\(\$\d+::text\[\]\)/g)).toHaveLength(2);
  });

  it('should never list private persons; owners never get authorities', () => {
    expect(OWNED_COMPANY_KINDS).not.toContain('private_person');
    expect(OWNED_COMPANY_KINDS).not.toContain('authority');
    expect(MEMBER_COMPANY_KINDS).not.toContain('private_person');
    expect(MEMBER_COMPANY_KINDS).toContain('authority');
  });

  it('should filter both branches by visibility for a viewer, not for the team', async () => {
    await repository.findCompanies(13, 9, 100);
    await repository.findCompanies(13, null, 100);

    const [viewerSql] = query.mock.calls[0] as [string];
    const [teamSql] = query.mock.calls[1] as [string];
    expect(viewerSql.match(/"p"\."visibility" = 'public'/g)).toHaveLength(2);
    expect(teamSql).not.toContain('"visibility"');
  });
});
