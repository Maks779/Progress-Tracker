import { Directory, File } from 'expo-file-system';

import { forgetExportFiles } from '../saveFile';

jest.mock('expo-file-system', () => {
  class MockFile {}
  class MockDirectory {
    list = jest.fn(() => []);
  }
  return { Paths: { cache: 'file:///cache' }, File: MockFile, Directory: jest.fn(() => new MockDirectory()) };
});

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

function cached(name: string) {
  return Object.assign(Object.create(File.prototype) as object, { name, delete: jest.fn() }) as {
    name: string;
    delete: jest.Mock;
  };
}

describe('forgetExportFiles', () => {
  it("removes Ember's exports from the app's cache and leaves everything else", async () => {
    const json = cached('ember-export.json');
    const csv = cached('ember-Книги.csv');
    const other = cached('ImagePicker-123.jpg');
    const folder = { name: 'ember-folder.csv', delete: jest.fn() };
    jest.mocked(Directory).mockImplementation(() => ({ list: () => [json, csv, other, folder] }) as never);

    await forgetExportFiles();

    expect(json.delete).toHaveBeenCalled();
    expect(csv.delete).toHaveBeenCalled();
    expect(other.delete).not.toHaveBeenCalled();
    expect(folder.delete).not.toHaveBeenCalled();
  });

  it('never fails the sign-out when the cache cannot be read', async () => {
    jest.mocked(Directory).mockImplementation(() => {
      throw new Error('No cache directory');
    });

    await expect(forgetExportFiles()).resolves.toBeUndefined();
  });
});
