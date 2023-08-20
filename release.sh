#!/bin/bash

# Certifique-se de estar na branch develop
git checkout develop
git pull origin develop

# Criar uma branch de release a partir da develop
release_version="0.1.0"
release_branch="release/$release_version"
git checkout -b "$release_branch"

# Faça as alterações necessárias para a versão de release (atualizações, correções, etc.)

# Commit das alterações na branch de release
git commit -am "release new version $release_version"

# Criar uma tag com a versão de release
tag="v$release_version-beta"
git tag "$tag"

# Empurrar a branch de release e a tag para o repositório remoto
git push origin "$release_branch"
git push origin "$tag"

# Voltar para a branch develop
git checkout develop

echo "Processo de release concluído com sucesso!"
