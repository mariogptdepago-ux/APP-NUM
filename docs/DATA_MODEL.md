# Modelo de datos

## Usuarios

| userId | fullName | grade | username | passwordHash | role | active | createdAt |

## Progreso

| userId | descriptorId | skillId | correct | wrong | attempts | mastery | retrievability | halfLifeHours | lastPracticeAt | nextReviewAt | status |

## Intentos

| attemptId | userId | descriptorId | skillId | questionId | familyId | variantIndex | correct | lost | burned | responseMs | selected | expected | masteryAfter | recallBefore | timestamp |

## Certificados

| certificateId | studentId | studentName | grade | axisId | axisName | descriptors | mastery | retrievability | issuedAt | issuedBy | status | signatureHash | verificationPayload | verificationUrl |

## Eventos

| eventId | userId | descriptorId | questionId | eventType | detail | timestamp |

## PreguntasQuemadas

| userId | questionId | familyId | reason | replacementQuestionId | timestamp |
