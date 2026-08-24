import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ContentController, getIstanbulDateKey } from '../src/content/content.controller';
import { ContentService } from '../src/content/content.service';

function createController() {
  const catalog = vi.fn();
  const findDaily = vi.fn();
  const service = {
    catalog,
    findById: vi.fn(),
    findDaily,
    list: vi.fn(),
  } as unknown as ContentService;

  return { catalog, controller: new ContentController(service), findDaily };
}

describe('ContentController', () => {
  it('uses the Istanbul calendar date', () => {
    expect(getIstanbulDateKey(new Date('2026-08-23T21:30:00Z'))).toBe('2026-08-24');
  });

  it('rejects invalid list parameters', async () => {
    const { controller } = createController();

    await expect(controller.list(undefined, undefined, 'impossible')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.list(undefined, undefined, undefined, '51')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects future daily dates before querying storage', async () => {
    const { controller, findDaily } = createController();

    await expect(controller.daily('2999-01-01')).rejects.toBeInstanceOf(BadRequestException);
    expect(findDaily).not.toHaveBeenCalled();
  });

  it('loads the visible catalog using the Istanbul date', async () => {
    const { catalog, controller } = createController();
    catalog.mockResolvedValue({ catalogVersion: 'catalog-test' });

    await controller.catalog();

    expect(catalog).toHaveBeenCalledWith(getIstanbulDateKey());
  });
});
