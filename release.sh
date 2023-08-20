#!/bin/bash

# Certifique-se de estar na branch develop
git checkout develop
git pull origin develop

# Criar uma branch de release a partir da develop
release_branch="release/$(date +'%Y%m%d_%H%M%S')"
git checkout -b "$release_branch"

# Faça as alterações necessárias para a versão de release (atualizações, correções, etc.)

# Commit das alterações na branch de release
git commit -am "Preparando para a release"

# Criar uma tag com a versão de release
tag="v$(date +'%Y.%m.%d')"
git tag "$tag"

# Empurrar a branch de release e a tag para o repositório remoto
git push origin "$release_branch"
git push origin "$tag"

# Voltar para a branch develop
git checkout develop

echo "Processo de release concluído com sucesso!"
